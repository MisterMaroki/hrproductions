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
  const toggleService = (
    service: "photography" | "standardVideo" | "agentPresentedVideo" | "drone"
  ) => {
    if (service === "standardVideo") {
      onChange({
        standardVideo: !property.standardVideo,
        agentPresentedVideo: false,
        drone: !property.standardVideo ? property.drone : false,
      });
    } else if (service === "agentPresentedVideo") {
      onChange({
        agentPresentedVideo: !property.agentPresentedVideo,
        standardVideo: false,
        drone: !property.agentPresentedVideo ? property.drone : false,
      });
    } else if (service === "drone") {
      if (property.standardVideo || property.agentPresentedVideo) {
        onChange({ drone: !property.drone });
      }
    } else if (service === "photography") {
      onChange({ photography: !property.photography });
    }
  };

  const hasVideo = property.standardVideo || property.agentPresentedVideo;
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
              onChange={(e) => onChange({ preferredDate: e.target.value })}
              className={styles.input}
              required
            />
          </label>
        </div>
      </div>

      <div className={styles.services}>
        <span className={styles.servicesLabel}>Services</span>
        <div className={styles.pills}>
          <button
            className={`${styles.pill} ${property.photography ? styles.active : ""}`}
            onClick={() => toggleService("photography")}
            type="button"
          >
            Photography
          </button>
          <button
            className={`${styles.pill} ${property.standardVideo ? styles.active : ""}`}
            onClick={() => toggleService("standardVideo")}
            type="button"
          >
            Property Video
          </button>
          <button
            className={`${styles.pill} ${property.drone ? styles.active : ""} ${!hasVideo ? styles.disabled : ""}`}
            onClick={() => toggleService("drone")}
            type="button"
            disabled={!hasVideo}
          >
            Drone Footage
          </button>
          <button
            className={`${styles.pill} ${property.agentPresentedVideo ? styles.active : ""}`}
            onClick={() => toggleService("agentPresentedVideo")}
            type="button"
          >
            Agent Presented
          </button>
        </div>
      </div>

      {property.photography && (
        <label className={styles.photoCount}>
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

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>&pound;{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
