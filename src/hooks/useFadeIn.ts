"use client";

import { useEffect, useRef } from "react";

export function useFadeIn<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(el);

    // Fallback for mobile Safari where IntersectionObserver can fail silently
    const fallback = setTimeout(() => {
      if (!el.classList.contains("visible")) {
        el.classList.add("visible");
      }
    }, 2000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return ref;
}
