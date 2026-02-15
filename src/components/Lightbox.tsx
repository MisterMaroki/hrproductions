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
    const video = videoRef.current;
    return () => {
      video?.pause();
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
            playsInline
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
