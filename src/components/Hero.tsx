"use client";

import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.imageWrap}>
        <Image
          src="/images/IMG_2905.JPG"
          alt="Property interior by Harrison Ross"
          fill
          priority
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <div className={styles.titleWrap}>
          <h1 className={styles.title}>
            <span className={styles.line}>Harrison</span>
            <span className={styles.line}>Ross</span>
          </h1>
        </div>
        <div className={styles.subtitleWrap}>
          <p className={styles.subtitle}>
            Property Videography &amp; Photography
          </p>
        </div>
        <div className={styles.ctaWrap}>
          <a href="#book" className={styles.cta}>
            <span className={styles.ctaText}>Book a Shoot</span>
            <span className={styles.ctaLine} />
          </a>
        </div>
      </div>
      <div className={styles.scrollIndicator}>
        <span className={styles.scrollLabel}>Scroll</span>
        <span className={styles.scrollLine} />
      </div>
    </section>
  );
}
