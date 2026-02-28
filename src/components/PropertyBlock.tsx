import { useState, useEffect, useCallback, useMemo } from "react";
import type { PropertyBooking } from "./BookingSection";
import { calcPropertyTotal } from "@/lib/pricing";
import { calcShootMinutes, isWorkingDay, TRAVEL_BUFFER, type TimeSlot } from "@/lib/scheduling";
import DatePicker from "./DatePicker";
import styles from "./PropertyBlock.module.css";

export interface SiblingBooking {
  date: string;
  timeSlot: string;   // "HH:MM" start
  durationMins: number;
}

interface Props {
  property: PropertyBooking;
  siblingBookings: SiblingBooking[];
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
  errors?: Record<string, string>;
  onClearError?: (field: string) => void;
}

export default function PropertyBlock({
  property,
  siblingBookings,
  onChange,
  onRemove,
  canRemove,
  errors = {},
  onClearError,
}: Props) {
  const togglePhotography = () => {
    onChange({ photography: !property.photography });
  };

  const toggleDronePhotography = () => {
    onChange({ dronePhotography: !property.dronePhotography });
  };

  const toggleStandardVideo = () => {
    const next = !property.standardVideo;
    onChange({
      standardVideo: next,
      agentPresentedVideo: false,
      agentPresentedVideoDrone: false,
      standardVideoDrone: next ? property.standardVideoDrone : false,
    });
  };

  const toggleAgentPresentedVideo = () => {
    const next = !property.agentPresentedVideo;
    onChange({
      agentPresentedVideo: next,
      standardVideo: false,
      standardVideoDrone: false,
      agentPresentedVideoDrone: next ? property.agentPresentedVideoDrone : false,
    });
  };

  const toggleSocialMediaVideo = () => {
    const next = !property.socialMediaVideo;
    onChange({
      socialMediaVideo: next,
      socialMediaPresentedVideo: false,
    });
  };

  const toggleSocialMediaPresentedVideo = () => {
    const next = !property.socialMediaPresentedVideo;
    onChange({
      socialMediaPresentedVideo: next,
      socialMediaVideo: false,
    });
  };

  const toggleFloorPlan = () => {
    const next = !property.floorPlan;
    onChange({
      floorPlan: next,
      floorPlanVirtualTour: false,
    });
  };

  const toggleFloorPlanVirtualTour = () => {
    const next = !property.floorPlanVirtualTour;
    onChange({
      floorPlanVirtualTour: next,
      floorPlan: false,
    });
  };

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

  const subtotal = calcPropertyTotal(property);

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
            placeholder="Key/lockbox codes, parking info, access instructions..."
            rows={3}
          />
        </label>
      </div>

      <div className={styles.services}>
        <span className={styles.servicesLabel}>Services</span>

        {/* Photography */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.photography ? styles.active : ""}`}
            onClick={togglePhotography}
            type="button"
          >
            Photography
          </button>
          {property.photography && (
            <label className={styles.serviceOption}>
              <span>Number of photos</span>
              <input
                type="number"
                value={property.photoCount}
                onChange={(e) => {
                  onChange({ photoCount: parseInt(e.target.value, 10) || 0 });
                  onClearError?.("photoCount");
                }}
                className={`${styles.input} ${errors.photoCount ? styles.inputError : ""}`}
              />
              {errors.photoCount && <span className={styles.error}>{errors.photoCount}</span>}
            </label>
          )}
        </div>

        {/* Drone Photography */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.dronePhotography ? styles.active : ""}`}
            onClick={toggleDronePhotography}
            type="button"
          >
            Drone Photography
          </button>
          {property.dronePhotography && (
            <label className={styles.serviceOption}>
              <span>Package</span>
              <select
                value={property.dronePhotoCount}
                onChange={(e) =>
                  onChange({ dronePhotoCount: parseInt(e.target.value, 10) as 8 | 20 })
                }
                className={styles.input}
              >
                <option value={8}>8 photos — £75</option>
                <option value={20}>20 photos — £140</option>
              </select>
            </label>
          )}
        </div>

        {/* Unpresented Property Video */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.standardVideo ? styles.active : ""}`}
            onClick={toggleStandardVideo}
            type="button"
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

        {/* Agent Presented Video */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.agentPresentedVideo ? styles.active : ""}`}
            onClick={toggleAgentPresentedVideo}
            type="button"
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

        {/* Social Media Video — Unpresented */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.socialMediaVideo ? styles.active : ""}`}
            onClick={toggleSocialMediaVideo}
            type="button"
          >
            Social Media Video (Unpresented)
          </button>
        </div>

        {/* Social Media Video — Presented */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.socialMediaPresentedVideo ? styles.active : ""}`}
            onClick={toggleSocialMediaPresentedVideo}
            type="button"
          >
            Social Media Video (Presented)
          </button>
        </div>

        {/* Floor Plan */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.floorPlan ? styles.active : ""}`}
            onClick={toggleFloorPlan}
            type="button"
          >
            Floor Plan
          </button>
        </div>

        {/* Floor Plan + Virtual Tour */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.floorPlanVirtualTour ? styles.active : ""}`}
            onClick={toggleFloorPlanVirtualTour}
            type="button"
          >
            Floor Plan + Virtual Tour
          </button>
        </div>
      </div>

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>&pound;{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
