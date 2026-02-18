"use client";

import { useRef, useEffect } from "react";
import styles from "./Hero.module.css";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.src = process.env.NEXT_PUBLIC_BUNNY_CDN_HERO_URL || "/hero.mp4";
    v.load();
    v.play().catch(() => {});
  }, []);

  return (
    <section className={styles.hero}>
      <div className={styles.videoWrap}>
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="none"
          className={styles.video}
        />
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
