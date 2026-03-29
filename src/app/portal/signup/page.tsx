"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function ClientSignupPage() {
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

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
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

  if (success) {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.successBlock}>
            <h1 className={styles.title}>Account Submitted</h1>
            <p className={styles.successText}>
              Your account is pending approval. We&apos;ll email you at{" "}
              <strong>{form.email}</strong> once your account is activated.
            </p>
            <Link href="/portal/login" className={styles.backLink}>
              Back to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>
          Sign up for a trade account to book shoots on credit
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.label}>
            Company Name
            <input
              className={styles.input}
              type="text"
              value={form.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Contact Name
            <input
              className={styles.input}
              type="text"
              value={form.contactName}
              onChange={(e) => handleChange("contactName", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Phone
            <input
              className={styles.input}
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              required
              minLength={8}
            />
          </label>

          <label className={styles.label}>
            Confirm Password
            <input
              className={styles.input}
              type="password"
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              required
            />
          </label>

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{" "}
          <Link href="/portal/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
