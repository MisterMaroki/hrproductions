"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import PortalNav from "../../components/PortalNav";
import DatePicker from "@/components/DatePicker";
import { evaluatePrice, evaluateDuration, calcMultiPropertyDiscount } from "@/lib/pricing-engine";
import { isWorkingDay, TRAVEL_BUFFER, type TimeSlot } from "@/lib/scheduling";
import { isWhiteLabel } from "@/lib/brand";
import styles from "./page.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface SelectedService {
  serviceId: string;
  inputs: Record<string, number | string | boolean>;
}

interface PropertyBooking {
  id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string;
  notes: string;
  selectedServices: SelectedService[];
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    postcode: "",
    bedrooms: 2,
    preferredDate: "",
    timeSlot: "",
    notes: "",
    selectedServices: [],
  };
}

// ── PropertyRow ───────────────────────────────────────────────────────────────

interface SiblingBooking {
  date: string;
  timeSlot: string;
  durationMins: number;
}

interface PropertyRowProps {
  property: PropertyBooking;
  index: number;
  serviceCategories: any[];
  siblingBookings: SiblingBooking[];
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
  errors: Record<string, string>;
  onClearError: (field: string) => void;
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function PropertyRow({
  property,
  index,
  serviceCategories,
  siblingBookings,
  onChange,
  onRemove,
  canRemove,
  errors,
  onClearError,
}: PropertyRowProps) {
  const [apiSlots, setApiSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [dateMessage, setDateMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const allServices = useMemo(
    () => serviceCategories.flatMap((c: any) => c.services ?? []),
    [serviceCategories]
  );

  // Total shoot duration in minutes
  const shootMinutes = useMemo(() => {
    return property.selectedServices.reduce((acc, sel) => {
      const svc = allServices.find((s: any) => s.id === sel.serviceId);
      if (!svc) return acc;
      return acc + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: property.bedrooms });
    }, 0);
  }, [property.selectedServices, property.bedrooms, allServices]);

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
      const res = await fetch(`/api/availability?date=${date}&duration=${duration}`);
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

  useEffect(() => {
    if (property.preferredDate && shootMinutes > 0) {
      fetchSlots(property.preferredDate, shootMinutes);
    } else {
      setApiSlots([]);
      setDateMessage(null);
    }
  }, [property.preferredDate, shootMinutes, fetchSlots]);

  // Filter out slots conflicting with siblings on same date
  const slots = useMemo(() => {
    if (apiSlots.length === 0) return [];
    const sameDateSiblings = siblingBookings.filter(
      (s) => s.date === property.preferredDate && s.timeSlot
    );
    if (sameDateSiblings.length === 0) return apiSlots;

    const blocked = sameDateSiblings.map((s) => {
      const [h, m] = s.timeSlot.split(":").map(Number);
      const start = h * 60 + m;
      return { start: start - TRAVEL_BUFFER, end: start + s.durationMins + TRAVEL_BUFFER };
    });

    return apiSlots.filter((slot) => {
      const [sh, sm] = slot.start.split(":").map(Number);
      const [eh, em] = slot.end.split(":").map(Number);
      const slotStart = sh * 60 + sm;
      const slotEnd = eh * 60 + em;
      return !blocked.some((b) => slotStart < b.end && slotEnd > b.start);
    });
  }, [apiSlots, siblingBookings, property.preferredDate]);

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

  useEffect(() => {
    if (property.timeSlot) {
      const stillValid = slots.some((s) => s.start === property.timeSlot);
      if (!stillValid && slots.length > 0) {
        onChange({ timeSlot: "" });
      }
    }
  }, [slots]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subtotal for this property
  const subtotal = useMemo(() => {
    return property.selectedServices.reduce((acc, sel) => {
      const svc = allServices.find((s: any) => s.id === sel.serviceId);
      if (!svc) return acc;
      return acc + evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: property.bedrooms }).total;
    }, 0);
  }, [property.selectedServices, property.bedrooms, allServices]);

  // Service toggle
  const toggleService = (serviceId: string) => {
    const existing = property.selectedServices.find(s => s.serviceId === serviceId);
    if (existing) {
      const svc = allServices.find((s: any) => s.id === serviceId);
      const idsToRemove = new Set([serviceId]);
      if (!svc?.isAddon) {
        allServices
          .filter((s: any) => s.parentServiceId === serviceId)
          .forEach((s: any) => idsToRemove.add(s.id));
      }
      onChange({ selectedServices: property.selectedServices.filter(s => !idsToRemove.has(s.serviceId)) });
    } else {
      const svc = allServices.find((s: any) => s.id === serviceId);
      if (!svc) return;
      const defaults: Record<string, number | string | boolean> = {};
      for (const field of (svc.inputFields ?? [])) {
        defaults[field.key] =
          field.default !== undefined
            ? field.default
            : field.type === "number"
            ? (field.min ?? 0)
            : field.type === "boolean"
            ? false
            : field.options?.[0]?.value ?? "";
      }
      onChange({ selectedServices: [...property.selectedServices, { serviceId, inputs: defaults }] });
    }
  };

  const updateInput = (serviceId: string, key: string, value: number | string | boolean) => {
    const newServices = property.selectedServices.map(sel =>
      sel.serviceId === serviceId
        ? { ...sel, inputs: { ...sel.inputs, [key]: value } }
        : sel
    );
    onChange({ selectedServices: newServices });
  };

  const renderInputField = (serviceId: string, field: any, currentInputs: Record<string, any>) => {
    if (field.type === "number") {
      return (
        <div key={field.key} className={styles.serviceOption}>
          <span>{field.label}</span>
          <input
            type="number"
            value={currentInputs[field.key] ?? field.default ?? field.min ?? 0}
            min={field.min}
            max={field.max}
            onChange={(e) => updateInput(serviceId, field.key, parseInt(e.target.value, 10) || 0)}
            className={`${styles.input} ${styles.numInput}`}
          />
        </div>
      );
    }
    if (field.type === "select") {
      return (
        <div key={field.key} className={styles.serviceOption}>
          <span>{field.label}</span>
          <select
            value={currentInputs[field.key] ?? field.default ?? field.options?.[0]?.value}
            onChange={(e) => {
              const opt = field.options?.find((o: any) => String(o.value) === e.target.value);
              updateInput(serviceId, field.key, opt?.value ?? e.target.value);
            }}
            className={`${styles.input} ${styles.selectInput}`}
          >
            {field.options?.map((opt: any) => (
              <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }
    if (field.type === "boolean") {
      return (
        <label key={field.key} className={styles.serviceOption}>
          <input
            type="checkbox"
            checked={!!(currentInputs[field.key] ?? field.default ?? false)}
            onChange={(e) => updateInput(serviceId, field.key, e.target.checked)}
            className={styles.checkbox}
          />
          <span>{field.label}</span>
        </label>
      );
    }
    return null;
  };

  return (
    <div className={styles.propertyBlock}>
      <div className={styles.blockHeader}>
        <span className={styles.blockTitle}>Property {index + 1}</span>
        {canRemove && (
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {/* Address & Postcode */}
      <div className={styles.fieldGroup}>
        <label className={styles.field}>
          <span className={styles.label}>Address</span>
          <input
            type="text"
            value={property.address}
            onChange={(e) => { onChange({ address: e.target.value }); onClearError("address"); }}
            className={`${styles.input} ${errors.address ? styles.inputError : ""}`}
            placeholder="Full property address"
            {...(errors.address ? { "data-validation-error": true } : {})}
          />
          {errors.address && <span className={styles.errorMsg}>{errors.address}</span>}
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Postcode</span>
            <input
              type="text"
              value={property.postcode}
              onChange={(e) => {
                const val = e.target.value;
                onChange({ postcode: val });
                const cleaned = val.replace(/\s/g, "").toUpperCase();
                if (/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned)) onClearError("postcode");
              }}
              className={`${styles.input} ${errors.postcode ? styles.inputError : ""}`}
              placeholder="e.g. BN1 1AA"
              {...(errors.postcode ? { "data-validation-error": true } : {})}
            />
            {errors.postcode && <span className={styles.errorMsg}>{errors.postcode}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Bedrooms</span>
            <select
              value={property.bedrooms}
              onChange={(e) => onChange({ bedrooms: parseInt(e.target.value, 10) })}
              className={styles.input}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n === 10 ? "10+" : n}</option>
              ))}
            </select>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Date</span>
            <DatePicker
              value={property.preferredDate}
              onChange={(date) => {
                onChange({ preferredDate: date, timeSlot: "" });
                onClearError("preferredDate");
                onClearError("timeSlot");
              }}
              error={errors.preferredDate}
            />
            {slotsLoading && <p className={styles.dateChecking}>Checking availability…</p>}
            {dateMessage && !slotsLoading && (
              <p className={dateMessage.ok ? styles.dateAvailable : styles.dateUnavailable}>
                {dateMessage.text}
              </p>
            )}
          </div>
        </div>

        {/* Time slot picker */}
        {property.preferredDate && shootMinutes > 0 && slots.length > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>
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
                  onClick={() => { onChange({ timeSlot: slot.start }); onClearError("timeSlot"); }}
                >
                  {formatTime(slot.start)} – {formatTime(slot.end)}
                </button>
              ))}
            </div>
            {errors.timeSlot && <span className={styles.errorMsg}>{errors.timeSlot}</span>}
          </div>
        )}

        <label className={styles.field}>
          <span className={styles.label}>Notes &amp; Access</span>
          <textarea
            value={property.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
            placeholder="Key/lockbox codes, parking info, access instructions..."
            rows={3}
          />
        </label>
      </div>

      {/* Dynamic Services */}
      <div className={styles.servicesSection}>
        <span className={styles.servicesLabel}>Services</span>

        {serviceCategories.length === 0 ? (
          <p className={styles.dateChecking}>Loading services…</p>
        ) : (
          serviceCategories.map((cat: any) => (
            <div key={cat.id} className={styles.serviceGroup}>
              {cat.services
                .filter((svc: any) => !svc.isAddon)
                .map((svc: any) => {
                  const sel = property.selectedServices.find(s => s.serviceId === svc.id);
                  const isSelected = !!sel;
                  const price = isSelected
                    ? evaluatePrice(svc.pricingRules, { ...sel!.inputs, bedrooms: property.bedrooms }).total
                    : evaluatePrice(svc.pricingRules, { bedrooms: property.bedrooms }).total;

                  // Addons for this service
                  const addons = allServices.filter(
                    (s: any) => s.isAddon && s.parentServiceId === svc.id
                  );

                  return (
                    <div key={svc.id}>
                      <button
                        type="button"
                        className={`${styles.pill} ${isSelected ? styles.pillActive : ""}`}
                        onClick={() => toggleService(svc.id)}
                      >
                        {svc.name}
                        {!isSelected && price > 0 && (
                          <span className={styles.pillPrice}> — £{price.toFixed(0)}</span>
                        )}
                      </button>

                      {/* Input fields */}
                      {isSelected && svc.inputFields?.length > 0 && (
                        <div>
                          {svc.inputFields.map((field: any) =>
                            renderInputField(svc.id, field, sel!.inputs)
                          )}
                        </div>
                      )}

                      {/* Addon services */}
                      {isSelected && addons.map((addon: any) => {
                        const addonSel = property.selectedServices.find(s => s.serviceId === addon.id);
                        const addonSelected = !!addonSel;
                        const addonPrice = evaluatePrice(addon.pricingRules, { bedrooms: property.bedrooms }).total;
                        return (
                          <div key={addon.id}>
                            <label className={styles.serviceOption}>
                              <input
                                type="checkbox"
                                checked={addonSelected}
                                onChange={() => toggleService(addon.id)}
                                className={styles.checkbox}
                              />
                              <span>{addon.name} (+£{addonPrice.toFixed(0)})</span>
                            </label>
                            {addonSelected && addon.inputFields?.length > 0 && (
                              <div>
                                {addon.inputFields.map((field: any) =>
                                  renderInputField(addon.id, field, addonSel!.inputs)
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          ))
        )}
      </div>

      {subtotal > 0 && (
        <div className={styles.propertySubtotal}>
          Subtotal: <strong>£{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortalNewBookingPage() {
  const router = useRouter();
  const whitelabel = isWhiteLabel();

  useEffect(() => {
    if (whitelabel) router.replace("/book");
  }, [whitelabel, router]);

  if (whitelabel) {
    return (
      <main style={{ padding: 40 }}>
        <p>Redirecting to booking form…</p>
      </main>
    );
  }

  const [properties, setProperties] = useState<PropertyBooking[]>([createProperty()]);
  const [serviceCategories, setServiceCategories] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then(setServiceCategories)
      .catch(console.error);
  }, []);

  const addProperty = () => setProperties((prev) => [...prev, createProperty()]);

  const updateProperty = (id: string, updates: Partial<PropertyBooking>) =>
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));

  const removeProperty = (id: string) =>
    setProperties((prev) => prev.filter((p) => p.id !== id));

  const allServices = useMemo(
    () => serviceCategories.flatMap((c: any) => c.services ?? []),
    [serviceCategories]
  );

  const siblingMap = useMemo(() => {
    const map = new Map<string, SiblingBooking[]>();
    for (const p of properties) {
      const siblings: SiblingBooking[] = properties
        .filter((s) => s.id !== p.id && s.preferredDate && s.timeSlot)
        .map((s) => ({
          date: s.preferredDate,
          timeSlot: s.timeSlot,
          durationMins: s.selectedServices.reduce((total, sel) => {
            const svc = allServices.find((sv: any) => sv.id === sel.serviceId);
            if (!svc) return total;
            return total + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: s.bedrooms });
          }, 0),
        }));
      map.set(p.id, siblings);
    }
    return map;
  }, [properties, allServices]);

  const clearPropertyError = useCallback((propertyId: string, field: string) => {
    setErrors((prev) => {
      const propErrors = prev[propertyId];
      if (!propErrors?.[field]) return prev;
      const { [field]: _, ...rest } = propErrors;
      const next = { ...prev };
      if (Object.keys(rest).length === 0) {
        delete next[propertyId];
      } else {
        next[propertyId] = rest;
      }
      return next;
    });
  }, []);

  const validate = useCallback((): boolean => {
    const propErrors: Record<string, Record<string, string>> = {};

    for (const p of properties) {
      const pErr: Record<string, string> = {};
      if (!p.address.trim()) pErr.address = "Address is required";
      if (!p.postcode.trim()) {
        pErr.postcode = "Postcode is required";
      } else {
        const pc = p.postcode.replace(/\s/g, "").toUpperCase();
        if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) pErr.postcode = "Enter a valid UK postcode";
      }
      if (!p.preferredDate) {
        pErr.preferredDate = "Date is required";
      } else {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (new Date(p.preferredDate) < tomorrow) {
          pErr.preferredDate = "Date must be in the future";
        } else if (!isWorkingDay(p.preferredDate)) {
          pErr.preferredDate = "We only operate Monday – Saturday";
        }
      }
      const hasServices = p.selectedServices.length > 0;
      if (!hasServices) {
        pErr.services = "Select at least one service";
      } else if (!p.timeSlot) {
        pErr.timeSlot = "Please select a time slot";
      }
      if (Object.keys(pErr).length > 0) propErrors[p.id] = pErr;
    }

    setErrors(propErrors);

    if (Object.keys(propErrors).length > 0) {
      setTimeout(() => {
        const el = document.querySelector("[data-validation-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return false;
    }
    return true;
  }, [properties]);

  // Summary calculations
  const propertyTotals = properties.map((p) => {
    const items = p.selectedServices.map((sel) => {
      const svc = allServices.find((s: any) => s.id === sel.serviceId);
      if (!svc) return null;
      const result = evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms });
      return { label: svc.name, price: result.total };
    }).filter(Boolean) as { label: string; price: number }[];

    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return { property: p, items, subtotal };
  });

  const subtotalBeforeDiscount = propertyTotals.reduce((sum, p) => sum + p.subtotal, 0);
  const multiDiscount = calcMultiPropertyDiscount(properties.length);
  const grandTotal = Math.max(0, subtotalBeforeDiscount - multiDiscount);
  const hasItems = subtotalBeforeDiscount > 0;

  const handleBook = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/portal/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Booking failed");
      router.push("/portal/bookings");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.pageHeader}>
            <h1 className={styles.title}>New Booking</h1>
          </div>

          <div className={styles.layout}>
            {/* Left: Property forms */}
            <div className={styles.formCol}>
              {properties.map((property, index) => {
                const propErrors = errors[property.id] || {};
                return (
                  <PropertyRow
                    key={property.id}
                    property={property}
                    index={index}
                    serviceCategories={serviceCategories}
                    siblingBookings={siblingMap.get(property.id) || []}
                    onChange={(updates) => updateProperty(property.id, updates)}
                    onRemove={() => removeProperty(property.id)}
                    canRemove={properties.length > 1}
                    errors={propErrors}
                    onClearError={(field) => clearPropertyError(property.id, field)}
                  />
                );
              })}

              <button type="button" className={styles.addPropertyBtn} onClick={addProperty}>
                + Add Another Property
              </button>

              <div className={styles.disclaimer}>
                <h4 className={styles.disclaimerTitle}>Important Information</h4>
                <ul className={styles.disclaimerList}>
                  <li>Shoot times are allocated automatically based on your selected services.</li>
                  <li>Properties must include a full address. Shoots within 10 miles of Brighton are included. Properties beyond 10 miles will incur a per-mile travel charge, quoted separately.</li>
                  <li>Multi-property bookings on the same day receive £15 off each additional property.</li>
                  <li>All prices are exclusive of VAT.</li>
                  <li>Account bookings are invoiced after the shoot and collected via Direct Debit.</li>
                </ul>
              </div>
            </div>

            {/* Right: Summary + Book button */}
            <div className={styles.summaryCol}>
              <div className={styles.summary}>
                <h3 className={styles.summaryTitle}>Booking Summary</h3>

                {hasItems ? (
                  <>
                    {propertyTotals.map(({ property, items, subtotal }) => {
                      if (items.length === 0) return null;
                      return (
                        <div key={property.id} className={styles.summaryProperty}>
                          <p className={styles.summaryAddress}>
                            {property.address || "No address yet"}
                          </p>
                          {items.map((item) => (
                            <div key={item.label} className={styles.lineItem}>
                              <span>{item.label}</span>
                              <span>£{item.price.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className={styles.propSubtotal}>
                            <span>Subtotal</span>
                            <span>£{subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}

                    {multiDiscount > 0 && (
                      <div className={styles.discountLine}>
                        <span>Multi-property discount ({properties.length} properties)</span>
                        <span>-£{multiDiscount.toFixed(2)}</span>
                      </div>
                    )}

                    <div className={styles.grandTotal}>
                      <span>Total</span>
                      <span>£{grandTotal.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <p className={styles.summaryEmpty}>Select services to see pricing</p>
                )}

                {submitError && (
                  <div className={styles.submitError}>{submitError}</div>
                )}

                <button
                  type="button"
                  className={styles.bookBtn}
                  onClick={handleBook}
                  disabled={submitting || !hasItems}
                >
                  {submitting ? "Submitting…" : "Book"}
                </button>

                <p className={styles.summaryNote}>
                  Your booking will be placed as pending. We&apos;ll confirm shortly and invoice you after the shoot.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
