import styles from "./SectionHeader.module.css";

interface SectionHeaderProps {
  title: string;
  id: string;
}

export default function SectionHeader({ title, id }: SectionHeaderProps) {
  return (
    <div className={styles.header} id={id}>
      <h2 className={styles.title}>{title}</h2>
      <hr className={styles.rule} />
    </div>
  );
}
