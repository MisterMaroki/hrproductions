import type { AgentInfo } from "./BookingSection";
import styles from "./AgentDetails.module.css";

interface Props {
  agent: AgentInfo;
  onChange: (agent: AgentInfo) => void;
}

export default function AgentDetails({ agent, onChange }: Props) {
  const update = (field: keyof AgentInfo, value: string) =>
    onChange({ ...agent, [field]: value });

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
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Company</span>
          <input
            type="text"
            value={agent.company}
            onChange={(e) => update("company", e.target.value)}
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Email</span>
          <input
            type="email"
            value={agent.email}
            onChange={(e) => update("email", e.target.value)}
            className={styles.input}
            required
          />
        </label>
        <label className={styles.label}>
          <span>Phone</span>
          <input
            type="tel"
            value={agent.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={styles.input}
            required
          />
        </label>
      </div>
    </fieldset>
  );
}
