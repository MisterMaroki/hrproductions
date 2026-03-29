"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface AccountData {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  status: string;
  gocardlessMandateId: string | null;
  bookingsPaused: number;
  createdAt: string | null;
}

export default function AccountPage() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile form state
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/portal/account")
      .then((r) => r.json())
      .then((d: AccountData) => {
        setAccount(d);
        setCompanyName(d.companyName);
        setContactName(d.contactName);
        setPhone(d.phone);
        setLoading(false);
      });
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);

    const res = await fetch("/api/portal/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName, contactName, phone }),
    });

    const data = await res.json();
    setProfileSaving(false);

    if (res.ok) {
      setProfileMsg({ type: "success", text: "Changes saved successfully." });
      setAccount((prev) => prev ? { ...prev, companyName, contactName, phone } : prev);
    } else {
      setProfileMsg({ type: "error", text: data.error || "Failed to save changes." });
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    setPasswordSaving(true);

    const res = await fetch("/api/portal/account/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();
    setPasswordSaving(false);

    if (res.ok) {
      setPasswordMsg({ type: "success", text: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPasswordMsg({ type: "error", text: data.error || "Failed to change password." });
    }
  }

  if (loading || !account) {
    return (
      <>
        <PortalNav />
        <main className={styles.main}>
          <p className={styles.loading}>Loading...</p>
        </main>
      </>
    );
  }

  const hasMandateSetup = !!account.gocardlessMandateId;

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Account Settings</h1>

          <div className={styles.metaRow}>
            <span className={`${styles.statusBadge} ${styles[`status_${account.status}`]}`}>
              {account.status.replace(/_/g, " ")}
            </span>
            {account.bookingsPaused ? (
              <span className={styles.pausedBadge}>Bookings Paused</span>
            ) : null}
          </div>

          {/* Payment Method */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Payment Method</h2>
            {hasMandateSetup ? (
              <div className={styles.mandateActive}>
                <span className={styles.mandateCheck}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#16a34a"/><path d="M5.5 9L8 11.5L12.5 6.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="square"/></svg>
                </span>
                <span>Direct Debit mandate is active</span>
              </div>
            ) : (
              <div className={styles.mandateNotSet}>
                <p className={styles.mandateText}>No payment method set up.</p>
                {account.status === "active" ? (
                  <Link href="/portal/account/setup-mandate" className={styles.primaryBtn}>
                    Set Up Direct Debit
                  </Link>
                ) : (
                  <p className={styles.mandateHint}>Your account must be active before setting up a payment method.</p>
                )}
              </div>
            )}
          </section>

          {/* Profile Details */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Profile Details</h2>
            <form onSubmit={handleProfileSave} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Company Name</label>
                <input
                  className={styles.input}
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Contact Name</label>
                <input
                  className={styles.input}
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Email Address</label>
                <input
                  className={styles.inputReadonly}
                  type="email"
                  value={account.email}
                  readOnly
                  disabled
                />
                <p className={styles.fieldHint}>Email address cannot be changed.</p>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Phone Number</label>
                <input
                  className={styles.input}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              {profileMsg && (
                <p className={profileMsg.type === "success" ? styles.msgSuccess : styles.msgError}>
                  {profileMsg.text}
                </p>
              )}

              <button type="submit" className={styles.primaryBtn} disabled={profileSaving}>
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </section>

          {/* Change Password */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handlePasswordChange} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Current Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              {passwordMsg && (
                <p className={passwordMsg.type === "success" ? styles.msgSuccess : styles.msgError}>
                  {passwordMsg.text}
                </p>
              )}

              <button type="submit" className={styles.primaryBtn} disabled={passwordSaving}>
                {passwordSaving ? "Updating..." : "Change Password"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
