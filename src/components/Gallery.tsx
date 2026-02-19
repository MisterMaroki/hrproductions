"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SectionHeader from "./SectionHeader";
import Lightbox, { type LightboxItem } from "./Lightbox";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Gallery.module.css";

/* ─── Data ─────────────────────────────────────────────── */

interface PhotoEntry {
  id: string;
  title: string;
  src: string;
}

// Auto layout pattern — repeats every 8 photos
const LAYOUT_PATTERN = [
  { span: 12, aspect: "16/9" },  // hero
  { span: 6, aspect: "4/5" },    // half
  { span: 6, aspect: "4/5" },    // half
  { span: 4, aspect: "1/1" },    // third
  { span: 4, aspect: "1/1" },    // third
  { span: 4, aspect: "1/1" },    // third
  { span: 6, aspect: "4/5" },    // half
  { span: 6, aspect: "4/5" },    // half
];

function getLayoutForIndex(i: number) {
  const pattern = LAYOUT_PATTERN[i % LAYOUT_PATTERN.length];
  const groupStart = Math.floor(i / LAYOUT_PATTERN.length) * LAYOUT_PATTERN.length;
  const posInGroup = i - groupStart;
  // Stagger delay within each row group
  let delay = 0;
  if (posInGroup === 2) delay = 0.12;
  if (posInGroup === 4) delay = 0.1;
  if (posInGroup === 5) delay = 0.2;
  if (posInGroup === 7) delay = 0.12;
  return { ...pattern, delay };
}

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

  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>([]);
  const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);

  useEffect(() => {
    fetch("/api/photos")
      .then((res) => res.json())
      .then((data) => setPhotoEntries(data))
      .catch(() => {});
  }, []);

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

  const photoGridRef = useGridReveal(photoEntries);
  const videoGridRef = useGridReveal(videoEntries);

  /* ── Open helpers ── */

  const openPhoto = (i: number) => {
    const items: LightboxItem[] = photoEntries.map((p) => ({
      type: "image",
      src: p.src,
      alt: p.title,
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
        <SectionHeader title="Photography" id="work" />
        {photoEntries.length > 0 ? (
          <div ref={photoGridRef} className={styles.grid}>
            {photoEntries.map((item, i) => {
              const layout = getLayoutForIndex(i);
              const isHero = layout.span === 12;
              return (
                <button
                  key={item.id}
                  className={`${styles.gridItem} ${styles.imageItem} ${isHero ? styles.heroItem : ""}`}
                  style={{
                    "--delay": `${layout.delay}s`,
                    "--span": `${layout.span}`,
                    "--aspect": layout.aspect,
                  } as React.CSSProperties}
                  onClick={() => openPhoto(i)}
                >
                  <Image
                    src={item.src}
                    alt={item.title}
                    fill
                    sizes={
                      layout.span === 12
                        ? "100vw"
                        : layout.span >= 7
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
        ) : (
          <div className={styles.placeholder}>
            <p className={styles.placeholderText}>Coming soon</p>
          </div>
        )}

        {/* ── Videos ── */}
        <div className={styles.sectionSpacer} />
        <SectionHeader title="Video" id="video" />
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
