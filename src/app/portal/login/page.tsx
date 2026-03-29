"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { isWhiteLabel } from "@/lib/brand";
import styles from "./page.module.css";

const SHOWCASE_IMAGES = [
  "/images/IMG_2912.JPG",
  "/images/IMG_2900.JPG",
  "/images/IMG_2906.JPG",
  "/images/IMG_2904.JPG",
  "/images/IMG_2909.JPG",
];

export default function ClientLoginPage() {
  const router = useRouter();
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Cycle images every 5 seconds with crossfade
  useEffect(() => {
    const timer = setInterval(() => {
      setImageLoaded(false);
      setTimeout(() => {
        setImageIndex((i) => (i + 1) % SHOWCASE_IMAGES.length);
        setImageLoaded(true);
      }, 600);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.client.status === "pending_approval") {
        router.push("/portal/dashboard");
      } else if (!data.client.hasMandateSetup) {
        router.push("/portal/account/setup-mandate");
      } else {
        router.push("/portal/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      {/* Left panel — imagery */}
      <div className={styles.imagePanel}>
        <div className={`${styles.imageWrapper} ${imageLoaded ? styles.imageVisible : styles.imageHidden}`}>
          <Image
            src={SHOWCASE_IMAGES[imageIndex]}
            alt="Property photography by The Property Room"
            fill
            className={styles.image}
            priority={imageIndex === 0}
          />
        </div>
        <div className={styles.imageOverlay} />
        <div className={styles.imageContent}>
          {!isWhiteLabel() && (
            <Link href="/" className={styles.logoLink}>
              <span className={styles.logo}>The Property Room</span>
            </Link>
          )}
          <div className={styles.imageBottom}>
            <p className={styles.imageQuote}>
              Your property marketing portal
            </p>
            <div className={styles.imageDots}>
              {SHOWCASE_IMAGES.map((_, i) => (
                <span
                  key={i}
                  className={`${styles.imageDot} ${i === imageIndex ? styles.imageDotActive : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          {/* Header with sign-up link */}
          <div className={styles.formHeader}>
            <span className={styles.formHeaderText}>Don&apos;t have an account?</span>
            <Link href="/portal/signup" className={styles.signUpLink}>Sign up</Link>
          </div>

          <div className={styles.formBody}>
            <div className={styles.formIntro}>
              <h1 className={styles.formTitle}>Welcome back</h1>
              <p className={styles.formSubtitle}>Sign in to your client portal</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.fields}>
              <label className={styles.label}>
                <span className={styles.labelText}>Email Address</span>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ""}`}
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="james@foxtons.co.uk"
                  required
                  autoFocus
                />
              </label>

              <label className={styles.label}>
                <span className={styles.labelText}>Password</span>
                <input
                  className={`${styles.input} ${error ? styles.inputError : ""}`}
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Your password"
                  required
                />
              </label>

              {error && <p className={styles.error}>{error}</p>}

              <button
                className={styles.submitBtn}
                type="submit"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
