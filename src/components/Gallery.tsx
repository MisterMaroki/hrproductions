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

interface VideoEntry {
  id: string;
  title: string;
  thumbnail: string;
  src: string;
}

/* ─── Scroll reveal hook ───────────────────────────────── */

function useReveal(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const items = el.querySelectorAll<HTMLElement>(`.${styles.albumCard}`);

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

  const loaded = photoEntries.length > 0 || videoEntries.length > 0;
  const albumsRef = useReveal(loaded);

  /* ── Open helpers ── */

  const openPhotos = () => {
    const items: LightboxItem[] = photoEntries.map((p) => ({
      type: "image",
      src: p.src,
      alt: p.title,
    }));
    setLightbox({ items, index: 0 });
  };

  const openVideos = () => {
    const items: LightboxItem[] = videoEntries.map((v) => ({
      type: "video",
      src: v.src,
      alt: v.title,
    }));
    setLightbox({ items, index: 0 });
  };

  return (
    <section ref={sectionRef} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Our Work" id="work" />

        <div ref={albumsRef} className={styles.albumGrid}>
          {/* ── Photography Album ── */}
          {photoEntries.length > 0 ? (
            <button
              className={styles.albumCard}
              style={{ "--delay": "0s" } as React.CSSProperties}
              onClick={openPhotos}
            >
              <Image
                src={photoEntries[0].src}
                alt="Photography"
                fill
                sizes="(max-width: 600px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
                priority
              />
              <div className={styles.albumOverlay}>
                <h3 className={styles.albumTitle}>Photography</h3>
                <span className={styles.albumCount}>
                  {photoEntries.length} {photoEntries.length === 1 ? "photo" : "photos"}
                </span>
              </div>
            </button>
          ) : (
            <div className={styles.albumPlaceholder}>
              <p className={styles.placeholderText}>Photography — Coming soon</p>
            </div>
          )}

          {/* ── Video Album ── */}
          {videoEntries.length > 0 ? (
            <button
              className={styles.albumCard}
              style={{ "--delay": "0.15s" } as React.CSSProperties}
              onClick={openVideos}
            >
              <Image
                src={videoEntries[0].thumbnail}
                alt="Video"
                fill
                sizes="(max-width: 600px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
              />
              <div className={styles.albumOverlay}>
                <div className={styles.playBadge}>
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <h3 className={styles.albumTitle}>Video</h3>
                <span className={styles.albumCount}>
                  {videoEntries.length} {videoEntries.length === 1 ? "video" : "videos"}
                </span>
              </div>
            </button>
          ) : (
            <div className={styles.albumPlaceholder}>
              <p className={styles.placeholderText}>Video — Coming soon</p>
            </div>
          )}
        </div>
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
