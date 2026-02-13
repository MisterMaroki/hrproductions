"use client";

import { useState } from "react";
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

export default function Gallery() {
  const ref = useFadeIn<HTMLElement>();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Work" id="work" />
        <div className={styles.grid}>
          {images.map((src, i) => (
            <button
              key={src}
              className={styles.item}
              onClick={() => setLightboxIndex(i)}
            >
              <Image
                src={`/images/${src}`}
                alt={`Property photograph ${i + 1}`}
                width={600}
                height={400}
                style={{ width: "100%", height: "auto" }}
              />
            </button>
          ))}
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
