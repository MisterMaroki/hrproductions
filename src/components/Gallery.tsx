"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import SectionHeader from "./SectionHeader";
import Lightbox from "./Lightbox";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Gallery.module.css";

const images = [
  "IMG_2897.JPG", "IMG_2898.JPG", "IMG_2899.JPG", "IMG_2900.JPG",
  "IMG_2901.JPG", "IMG_2902.JPG", "IMG_2903.JPG", "IMG_2904.JPG",
  "IMG_2905.JPG", "IMG_2906.JPG", "IMG_2907.JPG", "IMG_2908.JPG",
  "IMG_2909.JPG", "IMG_2910.JPG", "IMG_2911.JPG", "IMG_2912.JPG",
  "IMG_2913.JPG", "IMG_2914.JPG", "IMG_2916.JPG",
];

type LayoutItem =
  | { type: "image"; index: number; span: number; aspect: string; delay: number }
  | { type: "text"; variant: "manifesto" | "quote"; delay: number };

const layout: LayoutItem[] = [
  // Hero opener — cinematic first impression
  { type: "image", index: 0, span: 12, aspect: "16/9", delay: 0 },

  // Manifesto — establish the craft
  { type: "text", variant: "manifesto", delay: 0 },

  // Asymmetric pair — editorial tension
  { type: "image", index: 1, span: 7, aspect: "4/5", delay: 0 },
  { type: "image", index: 2, span: 5, aspect: "3/4", delay: 0.12 },

  // Reversed asymmetry — visual rhythm
  { type: "image", index: 3, span: 5, aspect: "1/1", delay: 0 },
  { type: "image", index: 4, span: 7, aspect: "4/5", delay: 0.12 },

  // Triple — rhythmic cadence
  { type: "image", index: 5, span: 4, aspect: "4/5", delay: 0 },
  { type: "image", index: 6, span: 4, aspect: "4/5", delay: 0.1 },
  { type: "image", index: 7, span: 4, aspect: "4/5", delay: 0.2 },

  // Pull quote — the one-liner
  { type: "text", variant: "quote", delay: 0 },

  // Large + accent
  { type: "image", index: 8, span: 8, aspect: "3/2", delay: 0 },
  { type: "image", index: 9, span: 4, aspect: "4/5", delay: 0.15 },

  // Mirror composition
  { type: "image", index: 10, span: 4, aspect: "4/5", delay: 0 },
  { type: "image", index: 11, span: 8, aspect: "3/2", delay: 0.15 },

  // Equal pair — balance
  { type: "image", index: 12, span: 6, aspect: "3/4", delay: 0 },
  { type: "image", index: 13, span: 6, aspect: "3/4", delay: 0.1 },

  // Cinematic ultrawide
  { type: "image", index: 14, span: 12, aspect: "21/9", delay: 0 },

  // Square triple — geometric rhythm
  { type: "image", index: 15, span: 4, aspect: "1/1", delay: 0 },
  { type: "image", index: 16, span: 4, aspect: "1/1", delay: 0.1 },
  { type: "image", index: 17, span: 4, aspect: "1/1", delay: 0.2 },

  // Closing hero
  { type: "image", index: 18, span: 12, aspect: "2/1", delay: 0 },
];

export default function Gallery() {
  const sectionRef = useFadeIn<HTMLElement>();
  const gridRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
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
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
    );

    const items = grid.querySelectorAll(`.${styles.gridItem}`);
    items.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Work" id="work" number="01 — Portfolio" />

        <div ref={gridRef} className={styles.grid}>
          {layout.map((item, i) => {
            if (item.type === "text") {
              return (
                <div
                  key={`text-${item.variant}`}
                  className={`${styles.gridItem} ${styles.textBlock}`}
                  style={{ "--delay": `${item.delay}s` } as React.CSSProperties}
                >
                  {item.variant === "manifesto" ? (
                    <p className={styles.manifestoText}>
                      We don&rsquo;t wait for perfect light&thinsp;&mdash;&thinsp;we
                      create it. Every room holds a feeling: the warmth, the space,
                      the sense of home. Our lens reveals what makes buyers fall in
                      love.
                    </p>
                  ) : (
                    <blockquote className={styles.quoteText}>
                      Midnight or midday.
                      <br />
                      The property always shines.
                    </blockquote>
                  )}
                </div>
              );
            }

            const isHero = item.span === 12;

            return (
              <button
                key={images[item.index]}
                className={`${styles.gridItem} ${styles.imageItem} ${
                  isHero ? styles.heroItem : ""
                }`}
                style={
                  {
                    "--delay": `${item.delay}s`,
                    "--span": `${item.span}`,
                    "--aspect": item.aspect,
                  } as React.CSSProperties
                }
                onClick={() => setLightboxIndex(item.index)}
              >
                <Image
                  src={`/images/${images[item.index]}`}
                  alt={`Property photograph ${item.index + 1}`}
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
      </div>

      {lightboxIndex !== null && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </section>
  );
}
