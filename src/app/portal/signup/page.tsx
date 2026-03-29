"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { isWhiteLabel } from "@/lib/brand";
import styles from "./page.module.css";

const SHOWCASE_IMAGES = [
  "/images/IMG_2904.JPG",
  "/images/IMG_2909.JPG",
  "/images/IMG_2906.JPG",
  "/images/IMG_2912.JPG",
  "/images/IMG_2900.JPG",
];

type Step = 1 | 2 | 3;

export default function ClientSignupPage() {
  const [step, setStep] = useState<Step>(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(true);

  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cycle images
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

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const validateStep1 = useCallback(() => {
    if (!form.companyName.trim()) {
      setError("Company name is required");
      return false;
    }
    if (!form.contactName.trim()) {
      setError("Contact name is required");
      return false;
    }
    setError("");
    return true;
  }, [form.companyName, form.contactName]);

  const validateStep2 = useCallback(() => {
    if (!form.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Enter a valid email address");
      return false;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required");
      return false;
    }
    setError("");
    return true;
  }, [form.email, form.phone]);

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    setError("");
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleSubmit = async () => {
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/portal/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (step < 3) handleNext();
      else handleSubmit();
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
              {isWhiteLabel()
                ? "Professional property photography and visual media services."
                : "Professional property marketing trusted by leading estate agents across the South East."}
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

      {/* Right panel — multi-step form */}
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          {/* Header with sign-in link */}
          <div className={styles.formHeader}>
            <span className={styles.formHeaderText}>Already have an account?</span>
            <Link href="/portal/login" className={styles.signInLink}>Sign in</Link>
          </div>

          {success ? (
            /* Success state */
            <div className={styles.successState}>
              <div className={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#0a0a0a" />
                  <path d="M15 24.5L21 30.5L33 18.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="square" />
                </svg>
              </div>
              <h1 className={styles.successTitle}>You&apos;re all set</h1>
              <p className={styles.successText}>
                Your trade account is pending approval. We&apos;ll email you at{" "}
                <strong>{form.email}</strong> once it&apos;s activated.
              </p>
              <p className={styles.successSub}>
                This usually takes less than 24 hours.
              </p>
              <Link href="/portal/login" className={styles.successBtn}>
                Go to Login
              </Link>
            </div>
          ) : (
            /* Form wizard */
            <div className={styles.wizard}>
              {/* Step indicator */}
              <div className={styles.stepIndicator}>
                {[1, 2, 3].map((s) => (
                  <div key={s} className={styles.stepRow}>
                    <div className={`${styles.stepCircle} ${step >= s ? styles.stepCircleActive : ""} ${step > s ? styles.stepCircleDone : ""}`}>
                      {step > s ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                        </svg>
                      ) : (
                        <span>{s}</span>
                      )}
                    </div>
                    <span className={`${styles.stepLabel} ${step >= s ? styles.stepLabelActive : ""}`}>
                      {s === 1 ? "Your Company" : s === 2 ? "Contact Details" : "Set Password"}
                    </span>
                    {s < 3 && <div className={`${styles.stepLine} ${step > s ? styles.stepLineDone : ""}`} />}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className={styles.stepContent}>
                {step === 1 && (
                  <div className={styles.stepBody}>
                    <div className={styles.stepIntro}>
                      <h1 className={styles.stepTitle}>Tell us about your company</h1>
                      <p className={styles.stepSubtitle}>
                        Open a trade account to book shoots on credit and receive a single monthly invoice.
                      </p>
                    </div>

                    <div className={styles.fields}>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Company Name</span>
                        <input
                          className={styles.input}
                          type="text"
                          value={form.companyName}
                          onChange={(e) => handleChange("companyName", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g. Foxtons Brighton"
                          autoFocus
                        />
                      </label>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Your Name</span>
                        <input
                          className={styles.input}
                          type="text"
                          value={form.contactName}
                          onChange={(e) => handleChange("contactName", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g. James Wilson"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className={styles.stepBody}>
                    <div className={styles.stepIntro}>
                      <h1 className={styles.stepTitle}>How can we reach you?</h1>
                      <p className={styles.stepSubtitle}>
                        We&apos;ll use these details for your invoices and booking confirmations.
                      </p>
                    </div>

                    <div className={styles.fields}>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Email Address</span>
                        <input
                          className={styles.input}
                          type="email"
                          value={form.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="james@foxtons.co.uk"
                          autoFocus
                        />
                      </label>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Phone Number</span>
                        <input
                          className={styles.input}
                          type="tel"
                          value={form.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="07700 900 000"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className={styles.stepBody}>
                    <div className={styles.stepIntro}>
                      <h1 className={styles.stepTitle}>Secure your account</h1>
                      <p className={styles.stepSubtitle}>
                        Choose a password to access your client portal for bookings, invoices, and account management.
                      </p>
                    </div>

                    <div className={styles.fields}>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Password</span>
                        <input
                          className={styles.input}
                          type="password"
                          value={form.password}
                          onChange={(e) => handleChange("password", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Minimum 8 characters"
                          autoFocus
                        />
                      </label>
                      <label className={styles.label}>
                        <span className={styles.labelText}>Confirm Password</span>
                        <input
                          className={styles.input}
                          type="password"
                          value={form.confirmPassword}
                          onChange={(e) => handleChange("confirmPassword", e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Re-enter your password"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {error && <p className={styles.error}>{error}</p>}

                {/* Navigation */}
                <div className={styles.navRow}>
                  {step > 1 && (
                    <button className={styles.backBtn} onClick={handleBack} type="button">
                      Back
                    </button>
                  )}
                  <div className={styles.navSpacer} />
                  {step < 3 ? (
                    <button className={styles.nextBtn} onClick={handleNext} type="button">
                      Continue
                    </button>
                  ) : (
                    <button
                      className={styles.nextBtn}
                      onClick={handleSubmit}
                      disabled={loading}
                      type="button"
                    >
                      {loading ? "Creating account..." : "Create Account"}
                    </button>
                  )}
                </div>
              </div>

              {/* Benefits strip */}
              <div className={styles.benefits}>
                <div className={styles.benefit}>
                  <span className={styles.benefitIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                  </span>
                  <span>No upfront payments</span>
                </div>
                <div className={styles.benefit}>
                  <span className={styles.benefitIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                  </span>
                  <span>Monthly Direct Debit</span>
                </div>
                <div className={styles.benefit}>
                  <span className={styles.benefitIcon}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"/></svg>
                  </span>
                  <span>Dedicated portal</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
