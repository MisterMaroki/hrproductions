"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SectionHeader from "./SectionHeader";
import Lightbox, { type LightboxItem } from "./Lightbox";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Gallery.module.css";

/* ─── Data ─────────────────────────────────────────────── */

type PhotoItem = {
  src: string;
  span: number;
  aspect: string;
  delay: number;
};

const photoImages = [
  "IMG_2897.JPG", "IMG_2898.JPG", "IMG_2899.JPG", "IMG_2900.JPG",
  "IMG_2901.JPG", "IMG_2902.JPG", "IMG_2903.JPG", "IMG_2904.JPG",
  "IMG_2905.JPG", "IMG_2906.JPG", "IMG_2907.JPG", "IMG_2908.JPG",
  "IMG_2909.JPG", "IMG_2910.JPG", "IMG_2911.JPG", "IMG_2912.JPG",
  "IMG_2913.JPG", "IMG_2914.JPG", "IMG_2916.JPG",
];

const photoLayout: PhotoItem[] = [
  { src: photoImages[0], span: 12, aspect: "16/9", delay: 0 },
  { src: photoImages[1], span: 7, aspect: "4/5", delay: 0 },
  { src: photoImages[2], span: 5, aspect: "3/4", delay: 0.12 },
  { src: photoImages[3], span: 5, aspect: "1/1", delay: 0 },
  { src: photoImages[4], span: 7, aspect: "4/5", delay: 0.12 },
  { src: photoImages[5], span: 4, aspect: "4/5", delay: 0 },
  { src: photoImages[6], span: 4, aspect: "4/5", delay: 0.1 },
  { src: photoImages[7], span: 4, aspect: "4/5", delay: 0.2 },
  { src: photoImages[8], span: 8, aspect: "3/2", delay: 0 },
  { src: photoImages[9], span: 4, aspect: "4/5", delay: 0.15 },
  { src: photoImages[10], span: 4, aspect: "4/5", delay: 0 },
  { src: photoImages[11], span: 8, aspect: "3/2", delay: 0.15 },
  { src: photoImages[12], span: 6, aspect: "3/4", delay: 0 },
  { src: photoImages[13], span: 6, aspect: "3/4", delay: 0.1 },
  { src: photoImages[14], span: 12, aspect: "21/9", delay: 0 },
  { src: photoImages[15], span: 4, aspect: "1/1", delay: 0 },
  { src: photoImages[16], span: 4, aspect: "1/1", delay: 0.1 },
  { src: photoImages[17], span: 4, aspect: "1/1", delay: 0.2 },
  { src: photoImages[18], span: 12, aspect: "2/1", delay: 0 },
];

type DroneItem = {
  src: string;
  span: number;
  aspect: string;
  delay: number;
};

// Drone photos — add filenames here when content is ready
const droneLayout: DroneItem[] = [
  // Example entries (uncomment and update when content arrives):
  // { src: "drone_001.jpg", span: 12, aspect: "21/9", delay: 0 },
  // { src: "drone_002.jpg", span: 6, aspect: "16/9", delay: 0 },
  // { src: "drone_003.jpg", span: 6, aspect: "16/9", delay: 0.12 },
];

type VideoEntry = {
  src: string;
  thumbnail: string;
  alt: string;
};

// Videos — add entries here when content is ready
const videoEntries: VideoEntry[] = [
  // Example entries (uncomment and update when content arrives):
  // { src: "/videos/tour_001.mp4", thumbnail: "/videos/thumb_001.jpg", alt: "Property tour" },
];

/* ─── Scroll reveal hook ───────────────────────────────── */

function useGridReveal(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const items = grid.querySelectorAll(`.${styles.gridItem}`);
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [dep]);

  return ref;
}

/* ─── Component ────────────────────────────────────────── */

export default function Gallery() {
  const sectionRef = useFadeIn<HTMLElement>();

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);

  const photoGridRef = useGridReveal(photoLayout);
  const droneGridRef = useGridReveal(droneLayout);
  const videoGridRef = useGridReveal(videoEntries);

  /* ── Open helpers ── */

  const openPhoto = (i: number) => {
    const items: LightboxItem[] = photoLayout.map((p) => ({
      type: "image",
      src: `/images/${p.src}`,
      alt: `Property photograph`,
    }));
    setLightbox({ items, index: i });
  };

  const openDrone = (i: number) => {
    const items: LightboxItem[] = droneLayout.map((d) => ({
      type: "image",
      src: `/images/${d.src}`,
      alt: `Drone photograph`,
    }));
    setLightbox({ items, index: i });
  };

  const openVideo = (i: number) => {
    const items: LightboxItem[] = videoEntries.map((v) => ({
      type: "video",
      src: v.src,
      alt: v.alt,
    }));
    setLightbox({ items, index: i });
  };

  return (
    <section ref={sectionRef} className={`${styles.section} fade-in`}>
      <div className={styles.container}>

        {/* ── Photography ── */}
        <SectionHeader title="Photography" id="work" number="01 — Photography" />
        <div ref={photoGridRef} className={styles.grid}>
          {photoLayout.map((item, i) => {
            const isHero = item.span === 12;
            return (
              <button
                key={item.src}
                className={`${styles.gridItem} ${styles.imageItem} ${isHero ? styles.heroItem : ""}`}
                style={{
                  "--delay": `${item.delay}s`,
                  "--span": `${item.span}`,
                  "--aspect": item.aspect,
                } as React.CSSProperties}
                onClick={() => openPhoto(i)}
              >
                <Image
                  src={`/images/${item.src}`}
                  alt={`Property photograph ${i + 1}`}
                  fill
                  sizes={
                    item.span === 12
                      ? "100vw"
                      : item.span >= 7
                        ? "(max-width: 900px) 100vw, 66vw"
                        : "(max-width: 900px) 50vw, 33vw"
                  }
                  style={{ objectFit: "cover" }}
                  {...(i === 0 ? { priority: true } : {})}
                />
              </button>
            );
          })}
        </div>

        {/* ── Drone Photography ── */}
        <div className={styles.sectionSpacer} />
        <SectionHeader title="Drone" id="drone" number="02 — Drone Photography" />
        {droneLayout.length > 0 ? (
          <div ref={droneGridRef} className={`${styles.grid} ${styles.droneGrid}`}>
            {droneLayout.map((item, i) => (
              <button
                key={item.src}
                className={`${styles.gridItem} ${styles.imageItem} ${item.span === 12 ? styles.heroItem : ""}`}
                style={{
                  "--delay": `${item.delay}s`,
                  "--span": `${item.span}`,
                  "--aspect": item.aspect,
                } as React.CSSProperties}
                onClick={() => openDrone(i)}
              >
                <Image
                  src={`/images/${item.src}`}
                  alt={`Drone photograph ${i + 1}`}
                  fill
                  sizes={item.span === 12 ? "100vw" : "(max-width: 900px) 100vw, 50vw"}
                  style={{ objectFit: "cover" }}
                />
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderText}>Coming soon</p>
          </div>
        )}

        {/* ── Videos ── */}
        <div className={styles.sectionSpacer} />
        <SectionHeader title="Video" id="video" number="03 — Video" />
        {videoEntries.length > 0 ? (
          <div ref={videoGridRef} className={`${styles.grid} ${styles.videoGrid}`}>
            {videoEntries.map((item, i) => (
              <button
                key={item.src}
                className={`${styles.gridItem} ${styles.videoItem}`}
                style={{ "--delay": `${i * 0.1}s` } as React.CSSProperties}
                onClick={() => openVideo(i)}
              >
                <Image
                  src={item.thumbnail}
                  alt={item.alt}
                  fill
                  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
                <div className={styles.playOverlay}>
                  <svg className={styles.playIcon} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderText}>Coming soon</p>
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightbox && (
        <Lightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={(i) => setLightbox((prev) => prev ? { ...prev, index: i } : null)}
        />
      )}
    </section>
  );
}
