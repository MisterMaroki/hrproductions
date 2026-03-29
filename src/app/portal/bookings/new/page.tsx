"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import PortalNav from "../../components/PortalNav";
import DatePicker from "@/components/DatePicker";
import {
  calcPropertyTotal,
  calcMultiPropertyDiscount,
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcSocialMediaVideo,
  calcSocialMediaPresentedVideo,
  calcStandardFloorPlan,
  calcPremiumFloorPlan,
  calcFloorPlan3D,
} from "@/lib/pricing";
import { calcShootMinutes, isWorkingDay, TRAVEL_BUFFER, type TimeSlot } from "@/lib/scheduling";
import styles from "./page.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface PropertyBooking {
  id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string;
  notes: string;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
  socialMediaVideo: boolean;
  socialMediaPresentedVideo: boolean;
  standardFloorPlan: boolean;
  premiumFloorPlan: boolean;
  floorPlan3D: boolean;
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
    photography: false,
    photoCount: 20,
    dronePhotography: false,
    dronePhotoCount: 8,
    standardVideo: false,
    standardVideoDrone: false,
    agentPresentedVideo: false,
    agentPresentedVideoDrone: false,
    socialMediaVideo: false,
    socialMediaPresentedVideo: false,
    standardFloorPlan: false,
    premiumFloorPlan: false,
    floorPlan3D: false,
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

  const shootMinutes = calcShootMinutes(property);

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

  const subtotal = calcPropertyTotal(property);

  // Service toggles
  const togglePhotography = () => onChange({ photography: !property.photography });
  const toggleDronePhotography = () => onChange({ dronePhotography: !property.dronePhotography });
  const toggleStandardVideo = () => {
    const next = !property.standardVideo;
    onChange({ standardVideo: next, agentPresentedVideo: false, agentPresentedVideoDrone: false, standardVideoDrone: next ? property.standardVideoDrone : false });
  };
  const toggleAgentPresentedVideo = () => {
    const next = !property.agentPresentedVideo;
    onChange({ agentPresentedVideo: next, standardVideo: false, standardVideoDrone: false, agentPresentedVideoDrone: next ? property.agentPresentedVideoDrone : false });
  };
  const toggleSocialMediaVideo = () => {
    const next = !property.socialMediaVideo;
    onChange({ socialMediaVideo: next, socialMediaPresentedVideo: false });
  };
  const toggleSocialMediaPresentedVideo = () => {
    const next = !property.socialMediaPresentedVideo;
    onChange({ socialMediaPresentedVideo: next, socialMediaVideo: false });
  };
  const toggleStandardFloorPlan = () => {
    const next = !property.standardFloorPlan;
    onChange({ standardFloorPlan: next, premiumFloorPlan: false, floorPlan3D: false });
  };
  const togglePremiumFloorPlan = () => {
    const next = !property.premiumFloorPlan;
    onChange({ standardFloorPlan: false, premiumFloorPlan: next, floorPlan3D: false });
  };
  const toggleFloorPlan3D = () => {
    const next = !property.floorPlan3D;
    onChange({ standardFloorPlan: false, premiumFloorPlan: false, floorPlan3D: next });
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

      {/* Services */}
      <div className={styles.servicesSection}>
        <span className={styles.servicesLabel}>Services</span>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.photography ? styles.pillActive : ""}`}
            onClick={togglePhotography}
          >
            Photography
          </button>
          {property.photography && (
            <div className={styles.serviceOption}>
              <span>Number of photos</span>
              <input
                type="number"
                value={property.photoCount}
                onChange={(e) => { onChange({ photoCount: parseInt(e.target.value, 10) || 0 }); onClearError("photoCount"); }}
                className={`${styles.input} ${styles.numInput} ${errors.photoCount ? styles.inputError : ""}`}
                min={20}
              />
              {errors.photoCount && <span className={styles.errorMsg}>{errors.photoCount}</span>}
            </div>
          )}
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.dronePhotography ? styles.pillActive : ""}`}
            onClick={toggleDronePhotography}
          >
            Drone Photography
          </button>
          {property.dronePhotography && (
            <div className={styles.serviceOption}>
              <span>Package</span>
              <select
                value={property.dronePhotoCount}
                onChange={(e) => onChange({ dronePhotoCount: parseInt(e.target.value, 10) as 8 | 20 })}
                className={`${styles.input} ${styles.selectInput}`}
              >
                <option value={8}>8 photos — £75</option>
                <option value={20}>20 photos — £140</option>
              </select>
            </div>
          )}
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.standardVideo ? styles.pillActive : ""}`}
            onClick={toggleStandardVideo}
          >
            Unpresented Property Video
          </button>
          {property.standardVideo && (
            <label className={styles.serviceOption}>
              <input
                type="checkbox"
                checked={property.standardVideoDrone}
                onChange={(e) => onChange({ standardVideoDrone: e.target.checked })}
                className={styles.checkbox}
              />
              <span>Add drone footage (+£65)</span>
            </label>
          )}
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.agentPresentedVideo ? styles.pillActive : ""}`}
            onClick={toggleAgentPresentedVideo}
          >
            Agent Presented Video
          </button>
          {property.agentPresentedVideo && (
            <label className={styles.serviceOption}>
              <input
                type="checkbox"
                checked={property.agentPresentedVideoDrone}
                onChange={(e) => onChange({ agentPresentedVideoDrone: e.target.checked })}
                className={styles.checkbox}
              />
              <span>Add drone footage (+£65)</span>
            </label>
          )}
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.socialMediaVideo ? styles.pillActive : ""}`}
            onClick={toggleSocialMediaVideo}
          >
            Social Media Video (Unpresented)
          </button>
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.socialMediaPresentedVideo ? styles.pillActive : ""}`}
            onClick={toggleSocialMediaPresentedVideo}
          >
            Social Media Video (Presented)
          </button>
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.standardFloorPlan ? styles.pillActive : ""}`}
            onClick={toggleStandardFloorPlan}
          >
            Standard Floor Plan
          </button>
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.premiumFloorPlan ? styles.pillActive : ""}`}
            onClick={togglePremiumFloorPlan}
          >
            Premium Floor Plan
          </button>
        </div>

        <div className={styles.serviceGroup}>
          <button
            type="button"
            className={`${styles.pill} ${property.floorPlan3D ? styles.pillActive : ""}`}
            onClick={toggleFloorPlan3D}
          >
            3D Floor Plan
          </button>
        </div>
      </div>

      {subtotal > 0 && (
        <div className={styles.propertySubtotal}>
          Subtotal: <strong>£{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}

// ── Line items for summary ────────────────────────────────────────────────────

function getLineItems(p: PropertyBooking) {
  const items: { label: string; price: number; indent?: boolean }[] = [];
  if (p.photography) {
    const price = calcPhotography(p.photoCount);
    items.push({ label: `Photography (${p.photoCount} photos)${p.photoCount >= 100 ? " — 10% off" : ""}`, price });
  }
  if (p.dronePhotography) {
    items.push({ label: `Drone Photography (${p.dronePhotoCount} photos)`, price: calcDronePhotography(p.dronePhotoCount) });
  }
  if (p.agentPresentedVideo) {
    items.push({ label: `Agent Presented Video (${p.bedrooms}-bed)`, price: calcAgentPresentedVideo(p.bedrooms) });
    if (p.agentPresentedVideoDrone) items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
  } else if (p.standardVideo) {
    items.push({ label: `Unpresented Video (${p.bedrooms}-bed)`, price: calcStandardVideo(p.bedrooms) });
    if (p.standardVideoDrone) items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
  }
  if (p.socialMediaPresentedVideo) {
    items.push({ label: `Social Media Video — Presented (${p.bedrooms}-bed)`, price: calcSocialMediaPresentedVideo(p.bedrooms) });
  } else if (p.socialMediaVideo) {
    items.push({ label: `Social Media Video — Unpresented (${p.bedrooms}-bed)`, price: calcSocialMediaVideo(p.bedrooms) });
  }
  if (p.floorPlan3D) {
    items.push({ label: `3D Floor Plan (${p.bedrooms}-bed)`, price: calcFloorPlan3D(p.bedrooms) });
  } else if (p.premiumFloorPlan) {
    items.push({ label: `Premium Floor Plan (${p.bedrooms}-bed)`, price: calcPremiumFloorPlan(p.bedrooms) });
  } else if (p.standardFloorPlan) {
    items.push({ label: `Standard Floor Plan (${p.bedrooms}-bed)`, price: calcStandardFloorPlan(p.bedrooms) });
  }
  return items;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PortalNewBookingPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<PropertyBooking[]>([createProperty()]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const addProperty = () => setProperties((prev) => [...prev, createProperty()]);

  const updateProperty = (id: string, updates: Partial<PropertyBooking>) =>
    setProperties((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));

  const removeProperty = (id: string) =>
    setProperties((prev) => prev.filter((p) => p.id !== id));

  const siblingMap = useMemo(() => {
    const map = new Map<string, SiblingBooking[]>();
    for (const p of properties) {
      const siblings: SiblingBooking[] = properties
        .filter((s) => s.id !== p.id && s.preferredDate && s.timeSlot)
        .map((s) => ({
          date: s.preferredDate,
          timeSlot: s.timeSlot,
          durationMins: calcShootMinutes(s),
        }));
      map.set(p.id, siblings);
    }
    return map;
  }, [properties]);

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
      const hasServices =
        p.photography || p.dronePhotography || p.standardVideo || p.agentPresentedVideo ||
        p.socialMediaVideo || p.socialMediaPresentedVideo || p.standardFloorPlan ||
        p.premiumFloorPlan || p.floorPlan3D;
      if (!hasServices) {
        pErr.services = "Select at least one service";
      } else if (!p.timeSlot) {
        pErr.timeSlot = "Please select a time slot";
      }
      if (p.photography && p.photoCount < 20) pErr.photoCount = "Minimum 20 photos";
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
  const propertyTotals = properties.map((p) => ({
    property: p,
    items: getLineItems(p),
    subtotal: calcPropertyTotal(p),
  }));

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
                            <div
                              key={item.label}
                              className={`${styles.lineItem} ${item.indent ? styles.lineItemIndented : ""}`}
                            >
                              <span>{item.indent ? `+ ${item.label}` : item.label}</span>
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
