"use client";

import SectionHeader from "./SectionHeader";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Contact.module.css";

export default function Contact() {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Contact" id="contact" />
        <div className={styles.grid}>
          <div className={styles.block}>
            <span className={styles.label}>Email</span>
            <a href="mailto:thepropertyroomco@gmail.com" className={styles.value}>
              thepropertyroomco@gmail.com
            </a>
          </div>
          <div className={styles.block}>
            <span className={styles.label}>Phone</span>
            <a href="tel:+447715345822" className={styles.value}>
              +44 7715 345822
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
