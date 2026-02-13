"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import styles from "./Lightbox.module.css";

interface LightboxProps {
  images: string[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export default function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: LightboxProps) {
  const goPrev = useCallback(
    () => onNavigate(index > 0 ? index - 1 : images.length - 1),
    [index, images.length, onNavigate]
  );
  const goNext = useCallback(
    () => onNavigate(index < images.length - 1 ? index + 1 : 0),
    [index, images.length, onNavigate]
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

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <button className={styles.close} onClick={onClose}>
        &#x2715;
      </button>
      <button
        className={`${styles.arrow} ${styles.left}`}
        onClick={(e) => {
          e.stopPropagation();
          goPrev();
        }}
      >
        &#8592;
      </button>
      <div className={styles.imageWrap} onClick={(e) => e.stopPropagation()}>
        <Image
          src={`/images/${images[index]}`}
          alt={`Property photograph ${index + 1}`}
          width={1200}
          height={800}
          style={{ width: "100%", height: "auto", maxHeight: "90vh", objectFit: "contain" }}
        />
      </div>
      <button
        className={`${styles.arrow} ${styles.right}`}
        onClick={(e) => {
          e.stopPropagation();
          goNext();
        }}
      >
        &#8594;
      </button>
    </div>,
    document.body
  );
}
