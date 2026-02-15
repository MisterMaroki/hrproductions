import { useState } from "react";
import type { PropertyBooking } from "./BookingSection";
import { calcPropertyTotal } from "@/lib/pricing";
import styles from "./PropertyBlock.module.css";

interface Props {
  property: PropertyBooking;
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function PropertyBlock({
  property,
  onChange,
  onRemove,
  canRemove,
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

  const [dateStatus, setDateStatus] = useState<{
    available: boolean;
    reason?: string;
    hoursRemaining?: number;
  } | null>(null);
  const [checkingDate, setCheckingDate] = useState(false);

  const checkDateAvailability = async (date: string) => {
    if (!date) {
      setDateStatus(null);
      return;
    }
    setCheckingDate(true);
    try {
      const res = await fetch(`/api/availability?date=${date}`);
      const data = await res.json();
      setDateStatus(data);
    } catch {
      setDateStatus(null);
    } finally {
      setCheckingDate(false);
    }
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
            onChange={(e) => onChange({ address: e.target.value })}
            className={styles.input}
            placeholder="Full property address"
            required
          />
        </label>

        <div className={styles.row}>
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

          <label className={styles.field}>
            <span>Preferred Date</span>
            <input
              type="date"
              value={property.preferredDate}
              onChange={(e) => {
                onChange({ preferredDate: e.target.value });
                checkDateAvailability(e.target.value);
              }}
              className={styles.input}
              required
            />
            {checkingDate && (
              <p className={styles.dateChecking}>Checking availability…</p>
            )}
            {dateStatus && !checkingDate && (
              <p className={dateStatus.available ? styles.dateAvailable : styles.dateUnavailable}>
                {dateStatus.available
                  ? `Available — ${dateStatus.hoursRemaining}h remaining`
                  : dateStatus.reason || "This date is unavailable"}
              </p>
            )}
          </label>
        </div>

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
                min={20}
                value={property.photoCount}
                onChange={(e) =>
                  onChange({ photoCount: Math.max(20, parseInt(e.target.value, 10) || 20) })
                }
                className={styles.input}
              />
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
      </div>

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>&pound;{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
