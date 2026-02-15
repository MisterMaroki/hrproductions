# Gallery Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the single flat gallery into three vertically stacked sections (Photography, Drone Photography, Videos) with tailored grids and a unified image+video lightbox.

**Architecture:** The existing `Gallery.tsx` is rewritten to render three sections, each with a `SectionHeader` and a grid tailored to its media type. The existing `Lightbox.tsx` is extended to support both image and video playback. CSS Modules are used for all styling, consistent with the rest of the project.

**Tech Stack:** Next.js 16, React 19, CSS Modules, Next/Image

---

### Task 1: Extend Lightbox to support video playback

**Files:**
- Modify: `src/components/Lightbox.tsx`
- Modify: `src/components/Lightbox.module.css`

**Step 1: Update Lightbox props and rendering**

Replace the entire contents of `src/components/Lightbox.tsx` with:

```tsx
"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import styles from "./Lightbox.module.css";

export type LightboxItem = {
  type: "image" | "video";
  src: string;
  alt: string;
};

interface LightboxProps {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: LightboxProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const goPrev = useCallback(
    () => onNavigate(index > 0 ? index - 1 : items.length - 1),
    [index, items.length, onNavigate]
  );
  const goNext = useCallback(
    () => onNavigate(index < items.length - 1 ? index + 1 : 0),
    [index, items.length, onNavigate]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  // Pause video when navigating away
  useEffect(() => {
    return () => {
      videoRef.current?.pause();
    };
  }, [index]);

  const current = items[index];

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <button className={styles.close} onClick={onClose}>
        &#x2715;
      </button>
      {items.length > 1 && (
        <button
          className={`${styles.arrow} ${styles.left}`}
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          &#8592;
        </button>
      )}
      <div className={styles.imageWrap} onClick={(e) => e.stopPropagation()}>
        {current.type === "video" ? (
          <video
            ref={videoRef}
            key={current.src}
            src={current.src}
            controls
            autoPlay
            className={styles.video}
          />
        ) : (
          <Image
            src={current.src}
            alt={current.alt}
            width={1200}
            height={800}
            style={{
              width: "100%",
              height: "auto",
              maxHeight: "90vh",
              objectFit: "contain",
            }}
          />
        )}
      </div>
      {items.length > 1 && (
        <button
          className={`${styles.arrow} ${styles.right}`}
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          &#8594;
        </button>
      )}
    </div>,
    document.body
  );
}
```

**Step 2: Add video styles to Lightbox CSS**

Add to the end of `src/components/Lightbox.module.css` (before any closing brace):

```css
.video {
  max-width: 85vw;
  max-height: 85vh;
  border-radius: 2px;
  outline: none;
}
```

**Step 3: Verify the build compiles**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npm run build`
Expected: Compiles (Gallery will error since it still uses old Lightbox API — that's fine, we fix it in Task 2)

**Step 4: Commit**

```bash
git add src/components/Lightbox.tsx src/components/Lightbox.module.css
git commit -m "feat: extend Lightbox to support image and video playback"
```

---

### Task 2: Rewrite Gallery component with three sections

**Files:**
- Rewrite: `src/components/Gallery.tsx`
- Rewrite: `src/components/Gallery.module.css`

**Step 1: Rewrite Gallery.tsx**

Replace the entire contents of `src/components/Gallery.tsx` with:

```tsx
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
```

**Step 2: Rewrite Gallery.module.css**

Replace the entire contents of `src/components/Gallery.module.css` with:

```css
.section {
  padding: var(--section-padding) var(--content-padding);
}

.container {
  max-width: var(--max-width);
  margin: 0 auto;
}

/* ── Section spacing ── */

.sectionSpacer {
  height: var(--section-padding);
}

/* ── Editorial Grid — 12-column ── */

.grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 12px;
}

/* ── Scroll-triggered reveal ── */

.gridItem {
  opacity: 0;
  transform: translateY(40px) scale(1.03);
  transition:
    opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: var(--delay, 0s);
}

.gridItem.revealed {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ── Image items (shared by photo + drone) ── */

.imageItem {
  grid-column: span var(--span, 12);
  position: relative;
  aspect-ratio: var(--aspect, 4/3);
  overflow: hidden;
  cursor: pointer;
  border: none;
  padding: 0;
  background: #1a1816;
  display: block;
  width: 100%;
}

.imageItem img {
  transition:
    transform 0.7s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.7s ease;
}

.imageItem:hover img {
  transform: scale(1.03);
  filter: brightness(1.06);
}

.imageItem::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.2) 0%, transparent 50%);
  opacity: 0;
  transition: opacity 0.5s ease;
  pointer-events: none;
}

.imageItem:hover::after {
  opacity: 1;
}

.heroItem {
  grid-column: 1 / -1;
}

/* ── Drone grid — wider aspect ratios ── */

.droneGrid {
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* ── Video grid — uniform 3-col ── */

.videoGrid {
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.videoItem {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  cursor: pointer;
  border: none;
  padding: 0;
  background: #1a1816;
  display: block;
  width: 100%;
  grid-column: span 1;
}

.videoItem img {
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}

.videoItem:hover img {
  transform: scale(1.03);
}

/* Play button overlay */

.playOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  transition: background 0.4s ease;
  pointer-events: none;
}

.videoItem:hover .playOverlay {
  background: rgba(0, 0, 0, 0.15);
}

.playIcon {
  width: 48px;
  height: 48px;
  color: var(--color-white);
  opacity: 0.85;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
}

.videoItem:hover .playIcon {
  transform: scale(1.15);
  opacity: 1;
}

/* ── Placeholder state ── */

.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6rem 2rem;
  border: 1px dashed var(--color-muted);
  border-radius: 2px;
}

.placeholderText {
  font-family: var(--font-body);
  font-size: 0.85rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

/* ── Tablet ── */

@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .imageItem {
    grid-column: span 1;
  }

  .heroItem {
    grid-column: 1 / -1;
  }

  .droneGrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .videoGrid {
    grid-template-columns: repeat(2, 1fr);
  }

  .sectionSpacer {
    height: 6rem;
  }
}

/* ── Mobile ── */

@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
    gap: 5px;
  }

  .imageItem {
    grid-column: 1 / -1;
  }

  .droneGrid {
    grid-template-columns: 1fr;
  }

  .videoGrid {
    grid-template-columns: 1fr;
  }

  .playIcon {
    width: 40px;
    height: 40px;
  }

  .sectionSpacer {
    height: 4rem;
  }
}
```

**Step 3: Build and verify**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npm run build`
Expected: Clean build, no errors.

**Step 4: Commit**

```bash
git add src/components/Gallery.tsx src/components/Gallery.module.css
git commit -m "feat: rework gallery into Photography, Drone, and Video sections"
```

---

### Task 3: Visual QA and refinements

**Files:**
- Potentially modify: `src/components/Gallery.tsx`
- Potentially modify: `src/components/Gallery.module.css`
- Potentially modify: `src/components/Nav.tsx`

**Step 1: Run dev server and verify**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npm run dev`
Verify in browser:
- Photography section renders with all 19 images in editorial grid
- Drone section shows "Coming soon" placeholder
- Videos section shows "Coming soon" placeholder
- Scroll animations work for all sections
- Lightbox opens on photo click with prev/next navigation
- Nav "Gallery" link scrolls to Photography section

**Step 2: Fix any visual issues found**

Address spacing, alignment, or animation timing issues discovered during QA.

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: gallery visual QA refinements"
```
