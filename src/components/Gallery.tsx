"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SectionHeader from "./SectionHeader";
import Lightbox, { type LightboxItem } from "./Lightbox";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Gallery.module.css";

/* ─── Data ─────────────────────────────────────────────── */

type GridItem = {
  src: string;
  span: number;
  aspect: string;
  delay: number;
};

const photoImages = [
  "1DSC01429.webp",
  "2DSC01414.webp",
  "3DSC01449.webp",
  "4DSC01181.webp",
  "5DJI_20260128175643_0562_D.webp",
  "6DSC01156.webp",
  "7DJI_20260211220307_0652_D.webp",
  "8_ESRGAN_71939.webp",
];

const photoLayout: GridItem[] = [
  { src: photoImages[0], span: 12, aspect: "16/9", delay: 0 },
  { src: photoImages[1], span: 6, aspect: "4/5", delay: 0 },
  { src: photoImages[2], span: 6, aspect: "4/5", delay: 0.12 },
  { src: photoImages[3], span: 4, aspect: "1/1", delay: 0 },
  { src: photoImages[4], span: 4, aspect: "1/1", delay: 0.1 },
  { src: photoImages[5], span: 4, aspect: "1/1", delay: 0.2 },
  { src: photoImages[6], span: 6, aspect: "4/5", delay: 0 },
  { src: photoImages[7], span: 6, aspect: "4/5", delay: 0.12 },
];

interface VideoEntry {
  id: string;
  title: string;
  thumbnail: string;
  src: string;
}

/* ─── Scroll reveal hook ───────────────────────────────── */

function useGridReveal(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = ref.current;
    if (!grid) return;

    const items = grid.querySelectorAll<HTMLElement>(`.${styles.gridItem}`);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealed);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05 }
    );

    items.forEach((item) => observer.observe(item));

    // Fallback: reveal all items after 2.5s in case IntersectionObserver
    // fails silently (known issue on mobile Safari with button elements)
    const fallback = setTimeout(() => {
      items.forEach((item) => {
        if (!item.classList.contains(styles.revealed)) {
          item.classList.add(styles.revealed);
        }
      });
    }, 2500);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [dep]);

  return ref;
}

/* ─── Component ────────────────────────────────────────── */

export default function Gallery() {
  const sectionRef = useFadeIn<HTMLElement>();

  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);

  useEffect(() => {
    fetch("/api/videos")
      .then((res) => res.json())
      .then((data) => setVideoEntries(data))
      .catch(() => {});
  }, []);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{
    items: LightboxItem[];
    index: number;
  } | null>(null);

  const photoGridRef = useGridReveal(photoLayout);
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

  const openVideo = (i: number) => {
    const items: LightboxItem[] = videoEntries.map((v) => ({
      type: "video",
      src: v.src,
      alt: v.title,
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

        {/* ── Videos ── */}
        <div className={styles.sectionSpacer} />
        <SectionHeader title="Video" id="video" number="02 — Video" />
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
                  alt={item.title}
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
