import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  title: string;
  id: string;
  number?: string;
}

export default function SectionHeader({ title, id, number }: SectionHeaderProps) {
  return (
    <div className={styles.header} id={id}>
      {number && <span className={styles.number}>{number}</span>}
      <h2 className={styles.title}>{title}</h2>
      <hr className={styles.rule} />
    </div>
  );
}
