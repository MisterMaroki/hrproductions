import { useState, useEffect, useCallback, useMemo } from "react";
import type { PropertyBooking } from "./BookingSection";
import { evaluatePrice, evaluateDuration } from "@/lib/pricing-engine";
import { isWorkingDay, TRAVEL_BUFFER, type TimeSlot } from "@/lib/scheduling";
import { isWhiteLabel } from "@/lib/brand";
import DatePicker from "./DatePicker";
import styles from "./PropertyBlock.module.css";

export interface SiblingBooking {
  date: string;
  timeSlot: string;   // "HH:MM" start
  durationMins: number;
}

interface Props {
  property: PropertyBooking;
  serviceCategories: any[]; // ResolvedCategory[]
  siblingBookings: SiblingBooking[];
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
  errors?: Record<string, string>;
  onClearError?: (field: string) => void;
}

export default function PropertyBlock({
  property,
  serviceCategories,
  siblingBookings,
  onChange,
  onRemove,
  canRemove,
  errors = {},
  onClearError,
}: Props) {
  const allServices = useMemo(
    () => serviceCategories.flatMap((c: any) => c.services ?? []),
    [serviceCategories]
  );

  const toggleService = (serviceId: string) => {
    const existing = property.selectedServices.find(s => s.serviceId === serviceId);
    if (existing) {
      // Remove service (and any add-ons whose parent is this service)
      const svc = allServices.find((s: any) => s.id === serviceId);
      const idsToRemove = new Set([serviceId]);
      if (!svc?.isAddon) {
        allServices
          .filter((s: any) => s.parentServiceId === serviceId)
          .forEach((s: any) => idsToRemove.add(s.id));
      }
      onChange({ selectedServices: property.selectedServices.filter(s => !idsToRemove.has(s.serviceId)) });
    } else {
      // Add service with default inputs
      const svc = allServices.find((s: any) => s.id === serviceId);
      if (!svc) return;
      const defaults: Record<string, number | string | boolean> = {};
      for (const field of (svc.inputFields ?? [])) {
        // Check if pricing rules have a minimum for this field
        const minRule = svc.pricingRules?.rules?.find((r: any) => r.type === "minimum" && r.input === field.key);
        const effectiveMin = minRule ? minRule.minValue : field.min;
        const effectiveDefault = field.default !== undefined ? field.default : effectiveMin;

        defaults[field.key] =
          effectiveDefault !== undefined
            ? effectiveDefault
            : field.type === "number"
            ? (effectiveMin ?? 0)
            : field.type === "boolean"
            ? false
            : field.options?.[0]?.value ?? "";
      }
      onChange({ selectedServices: [...property.selectedServices, { serviceId, inputs: defaults }] });
    }
  };

  const renderInputField = (serviceId: string, field: any, currentInputs: Record<string, any>, pricingRules?: any) => {
    const updateInput = (key: string, value: any) => {
      const newServices = property.selectedServices.map(sel =>
        sel.serviceId === serviceId
          ? { ...sel, inputs: { ...sel.inputs, [key]: value } }
          : sel
      );
      onChange({ selectedServices: newServices });
    };

    if (field.type === "number") {
      // Check if pricing rules have a minimum rule for this field
      const minRule = pricingRules?.rules?.find((r: any) => r.type === "minimum" && r.input === field.key);
      const effectiveMin = minRule ? minRule.minValue : field.min;

      return (
        <label key={field.key} className={styles.serviceOption}>
          <span>{field.label}{effectiveMin ? ` (min ${effectiveMin})` : ""}</span>
          <input
            type="number"
            value={currentInputs[field.key] ?? field.default ?? ""}
            min={effectiveMin}
            max={field.max}
            onChange={e => updateInput(field.key, parseInt(e.target.value, 10) || 0)}
            className={styles.input}
          />
        </label>
      );
    }
    if (field.type === "select") {
      return (
        <label key={field.key} className={styles.serviceOption}>
          <span>{field.label}</span>
          <select
            value={String(currentInputs[field.key] ?? field.default ?? "")}
            onChange={e => updateInput(field.key, e.target.value)}
            className={styles.input}
          >
            {(field.options ?? []).map((opt: any) => (
              <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
            ))}
          </select>
        </label>
      );
    }
    if (field.type === "boolean") {
      return (
        <label key={field.key} className={styles.serviceOption}>
          <input
            type="checkbox"
            checked={!!currentInputs[field.key]}
            onChange={e => updateInput(field.key, e.target.checked)}
            className={styles.checkbox}
          />
          <span>{field.label}</span>
        </label>
      );
    }
    return null;
  };

  const [apiSlots, setApiSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dateMessage, setDateMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const shootMinutes = property.selectedServices.reduce((total, sel) => {
    const svc = allServices.find((s: any) => s.id === sel.serviceId);
    if (!svc) return total;
    return total + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: property.bedrooms });
  }, 0);

  const fetchSlots = useCallback(async (date: string, duration: number) => {
    if (!date || duration <= 0) {
      setApiSlots([]);
      setDateMessage(null);
      return;
    }

    if (!isWorkingDay(date)) {
      setApiSlots([]);
      setDateMessage({ text: "We only operate Monday – Saturday", ok: false });
      return;
    }

    setSlotsLoading(true);
    try {
      const res = await fetch(
        `/api/availability?date=${date}&duration=${duration}`
      );
      const data = await res.json();

      if (!data.available && data.reason) {
        setApiSlots([]);
        setDateMessage({ text: data.reason, ok: false });
      } else if (data.slots?.length === 0) {
        setApiSlots([]);
        setDateMessage({ text: "No available slots on this date", ok: false });
      } else {
        setApiSlots(data.slots || []);
      }
    } catch {
      setApiSlots([]);
      setDateMessage(null);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Re-fetch slots when date or services change
  useEffect(() => {
    if (property.preferredDate && shootMinutes > 0) {
      fetchSlots(property.preferredDate, shootMinutes);
    } else {
      setApiSlots([]);
      setDateMessage(null);
    }
  }, [
    property.preferredDate,
    shootMinutes,
    fetchSlots,
  ]);

  // Filter out slots that conflict with sibling bookings on the same date
  const slots = useMemo(() => {
    if (apiSlots.length === 0) return [];

    const sameDateSiblings = siblingBookings.filter(
      (s) => s.date === property.preferredDate && s.timeSlot
    );

    if (sameDateSiblings.length === 0) return apiSlots;

    const blocked = sameDateSiblings.map((s) => {
      const [h, m] = s.timeSlot.split(":").map(Number);
      const start = h * 60 + m;
      return {
        start: start - TRAVEL_BUFFER,
        end: start + s.durationMins + TRAVEL_BUFFER,
      };
    });

    return apiSlots.filter((slot) => {
      const [sh, sm] = slot.start.split(":").map(Number);
      const [eh, em] = slot.end.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = eh * 60 + em;
      return !blocked.some((b) => slotStart < b.end && slotEnd > b.start);
    });
  }, [apiSlots, siblingBookings, property.preferredDate]);

  // Update date message after filtering
  useEffect(() => {
    if (slotsLoading || apiSlots.length === 0) return;
    if (slots.length === 0 && apiSlots.length > 0) {
      setDateMessage({ text: "No available slots on this date", ok: false });
    } else if (slots.length > 0) {
      setDateMessage({
        text: `${slots.length} time slot${slots.length === 1 ? "" : "s"} available`,
        ok: true,
      });
    }
  }, [slots, apiSlots, slotsLoading]);

  // Clear time slot when available slots change and it's no longer valid
  useEffect(() => {
    if (property.timeSlot) {
      const stillValid = slots.some((s) => s.start === property.timeSlot);
      if (!stillValid && slots.length > 0) {
        onChange({ timeSlot: "" });
      }
    }
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTime = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const period = h >= 12 ? "pm" : "am";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
  };

  const subtotal = property.selectedServices.reduce((total, sel) => {
    const svc = allServices.find((s: any) => s.id === sel.serviceId);
    if (!svc) return total;
    return total + evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: property.bedrooms }).total;
  }, 0);

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.label}>Property</span>
        {canRemove && (
          <button className={styles.remove} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Address</span>
          <input
            type="text"
            value={property.address}
            onChange={(e) => { onChange({ address: e.target.value }); onClearError?.("address"); }}
            className={`${styles.input} ${errors.address ? styles.inputError : ""}`}
            placeholder="Full property address"
            required
            {...(errors.address ? { "data-validation-error": true } : {})}
          />
          {errors.address && <span className={styles.error}>{errors.address}</span>}
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Postcode</span>
            <input
              type="text"
              value={property.postcode}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ postcode: val });
                const cleaned = val.replace(/\s/g, "").toUpperCase();
                if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) {
                  onClearError?.("postcode");
                }
              }}
              className={`${styles.input} ${errors.postcode ? styles.inputError : ""}`}
              placeholder="e.g. BN1 1AA"
              required
              {...(errors.postcode ? { "data-validation-error": true } : {})}
            />
            {errors.postcode && <span className={styles.error}>{errors.postcode}</span>}
          </label>

          <label className={styles.field}>
            <span>Bedrooms</span>
            <select
              value={property.bedrooms}
              onChange={(e) =>
                onChange({ bedrooms: parseInt(e.target.value, 10) })
              }
              className={styles.input}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 6 ? "6+" : n}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.field}>
            <span>Preferred Date</span>
            <DatePicker
              value={property.preferredDate}
              onChange={(date) => {
                onChange({ preferredDate: date, timeSlot: "" });
                onClearError?.("preferredDate");
                onClearError?.("timeSlot");
              }}
              error={errors.preferredDate}
            />
            {slotsLoading && (
              <p className={styles.dateChecking}>Checking availability…</p>
            )}
            {dateMessage && !slotsLoading && (
              <p className={dateMessage.ok ? styles.dateAvailable : styles.dateUnavailable}>
                {dateMessage.text}
              </p>
            )}
          </div>
        </div>

        {/* Time slot picker — shown when date is set and services are selected */}
        {property.preferredDate && shootMinutes > 0 && slots.length > 0 && (
          <div className={styles.field}>
            <span>
              Time Slot
              <span className={styles.slotDuration}>
                {Math.floor(shootMinutes / 60)}h{shootMinutes % 60 > 0 ? ` ${shootMinutes % 60}m` : ""} needed
              </span>
            </span>
            <div
              className={`${styles.slotGrid} ${errors.timeSlot ? styles.slotGridError : ""}`}
              {...(errors.timeSlot ? { "data-validation-error": true } : {})}
            >
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={`${styles.slotPill} ${property.timeSlot === slot.start ? styles.slotActive : ""}`}
                  onClick={() => {
                    onChange({ timeSlot: slot.start });
                    onClearError?.("timeSlot");
                  }}
                >
                  {formatTime(slot.start)} – {formatTime(slot.end)}
                </button>
              ))}
            </div>
            {errors.timeSlot && <span className={styles.error}>{errors.timeSlot}</span>}
          </div>
        )}

        <label className={styles.field}>
          <span>Notes &amp; Access</span>
          <textarea
            value={property.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
            placeholder={isWhiteLabel() ? "Client contact info, access details..." : "Key/lockbox codes, parking info, access instructions..."}
            rows={3}
          />
        </label>
      </div>

      <div className={styles.services}>
        <span className={styles.servicesLabel}>Services</span>

        {serviceCategories.map((cat: any) => (
          <div key={cat.id} className={styles.serviceGroup}>
            {cat.name && (
              <span className={styles.categoryLabel}>{cat.name}</span>
            )}
            {(cat.services ?? []).filter((s: any) => !s.isAddon).map((svc: any) => {
              const isSelected = property.selectedServices.some(sel => sel.serviceId === svc.id);
              const sel = property.selectedServices.find(sel => sel.serviceId === svc.id);
              const addons = (cat.services ?? []).filter((a: any) => a.isAddon && a.parentServiceId === svc.id);

              return (
                <div key={svc.id}>
                  <button
                    className={`${styles.pill} ${isSelected ? styles.active : ""}`}
                    onClick={() => toggleService(svc.id)}
                    type="button"
                  >
                    {svc.name}
                  </button>
                  {/* Input fields for selected service */}
                  {isSelected && (svc.inputFields ?? []).length > 0 && (
                    <div>
                      {(svc.inputFields ?? []).map((field: any) =>
                        renderInputField(svc.id, field, sel?.inputs ?? {}, svc.pricingRules)
                      )}
                    </div>
                  )}
                  {/* Add-on services */}
                  {isSelected && addons.map((addon: any) => {
                    const addonSelected = property.selectedServices.some(sel => sel.serviceId === addon.id);
                    return (
                      <label key={addon.id} className={styles.serviceOption}>
                        <input
                          type="checkbox"
                          checked={addonSelected}
                          onChange={() => toggleService(addon.id)}
                          className={styles.checkbox}
                        />
                        <span>{addon.description || addon.name}</span>
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>&pound;{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
