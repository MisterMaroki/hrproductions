"use client";

import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.videoWrap}>
        <video
          autoPlay
          muted
          loop
          playsInline
          className={styles.video}
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      </div>
      <div className={styles.overlay} />
      <div className={styles.content}>
        <div className={styles.rule} />
        <div className={styles.bar}>
          <h1 className={styles.headline}>
            Property Videography &amp; Photography
          </h1>
          <a href="#book" className={styles.cta}>
            Book a Shoot
          </a>
        </div>
      </div>
      <div className={styles.scrollIndicator}>
        <span className={styles.scrollTick} />
      </div>
    </section>
  );
}
