import type { AgentInfo, ValidationErrors } from "./BookingSection";
import styles from "./AgentDetails.module.css";

interface Props {
  agent: AgentInfo;
  onChange: (agent: AgentInfo) => void;
  errors: ValidationErrors["agent"];
  onClearError: (field: keyof AgentInfo) => void;
}

export default function AgentDetails({ agent, onChange, errors, onClearError }: Props) {
  const isValidUkPhone = (value: string) => {
    const cleaned = value.replace(/[\s\-()]/g, "");
    return /^(?:0[1-37]\d{8,9}|(?:\+44|0044)[1-37]\d{8,9})$/.test(cleaned);
  };

  const update = (field: keyof AgentInfo, value: string) => {
    onChange({ ...agent, [field]: value });
    if (field === "phone") {
      if (isValidUkPhone(value)) onClearError(field);
    } else {
      onClearError(field);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Your Details</legend>
      <div className={styles.grid}>
        <label className={styles.label}>
          <span>Name</span>
          <input
            type="text"
            value={agent.name}
            onChange={(e) => update("name", e.target.value)}
            className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
            required
            {...(errors.name ? { "data-validation-error": true } : {})}
          />
          {errors.name && <span className={styles.error}>{errors.name}</span>}
        </label>
        <label className={styles.label}>
          <span>Company</span>
          <input
            type="text"
            value={agent.company}
            onChange={(e) => update("company", e.target.value)}
            className={`${styles.input} ${errors.company ? styles.inputError : ""}`}
            required
            {...(errors.company ? { "data-validation-error": true } : {})}
          />
          {errors.company && <span className={styles.error}>{errors.company}</span>}
        </label>
        <label className={styles.label}>
          <span>Email</span>
          <input
            type="email"
            value={agent.email}
            onChange={(e) => update("email", e.target.value)}
            className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
            required
            {...(errors.email ? { "data-validation-error": true } : {})}
          />
          {errors.email && <span className={styles.error}>{errors.email}</span>}
        </label>
        <label className={styles.label}>
          <span>Phone</span>
          <input
            type="tel"
            value={agent.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={`${styles.input} ${errors.phone ? styles.inputError : ""}`}
            required
            {...(errors.phone ? { "data-validation-error": true } : {})}
          />
          {errors.phone && <span className={styles.error}>{errors.phone}</span>}
        </label>
      </div>
    </fieldset>
  );
}
