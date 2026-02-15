"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface DiscountCode {
  id: string;
  code: string;
  percentage: number;
  active: number;
  maxUses: number | null;
  timesUsed: number;
  expiresAt: string | null;
  createdAt: string;
}

export default function DiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCodes = useCallback(async () => {
    const res = await fetch("/api/admin/discounts");
    setCodes(await res.json());
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newPercentage) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          percentage: Number(newPercentage),
          maxUses: newMaxUses ? Number(newMaxUses) : null,
          expiresAt: newExpiry || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create code");
        return;
      }
      setNewCode("");
      setNewPercentage("");
      setNewMaxUses("");
      setNewExpiry("");
      fetchCodes();
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, currentActive: number) => {
    await fetch("/api/admin/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: currentActive ? 0 : 1 }),
    });
    fetchCodes();
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h2 className={styles.title}>Discount Codes</h2>

          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              className={styles.input}
              type="text"
              placeholder="Code (e.g. SUMMER25)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="number"
              placeholder="% off"
              min="1"
              max="100"
              value={newPercentage}
              onChange={(e) => setNewPercentage(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="number"
              placeholder="Max uses (optional)"
              min="1"
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
            />
            <input
              className={styles.input}
              type="date"
              placeholder="Expires (optional)"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
            <button className={styles.createBtn} type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
          </form>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Code</span>
              <span>Discount</span>
              <span>Uses</span>
              <span>Expires</span>
              <span>Status</span>
            </div>
            {codes.map((c) => (
              <div
                key={c.id}
                className={`${styles.tableRow} ${!c.active ? styles.inactive : ""}`}
              >
                <span className={styles.codeCell}>{c.code}</span>
                <span>{c.percentage}%</span>
                <span>
                  {c.timesUsed}{c.maxUses ? ` / ${c.maxUses}` : ""}
                </span>
                <span>{c.expiresAt || "—"}</span>
                <button
                  className={`${styles.toggleBtn} ${c.active ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleActive(c.id, c.active!)}
                >
                  {c.active ? "Active" : "Disabled"}
                </button>
              </div>
            ))}
            {codes.length === 0 && (
              <p className={styles.empty}>No discount codes yet</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
