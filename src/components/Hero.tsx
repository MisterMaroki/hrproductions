"use client";

import { useRef, useEffect } from "react";
import styles from "./Hero.module.css";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const mobileSrc = process.env.NEXT_PUBLIC_BUNNY_CDN_HERO_URL_MOBILE;
    const desktopSrc = process.env.NEXT_PUBLIC_BUNNY_CDN_HERO_URL || "/hero.mp4";
    v.muted = true;
    v.src = mobile && mobileSrc ? mobileSrc : desktopSrc;
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
