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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{
    percentage: string;
    maxUses: string;
    timesUsed: string;
    expiresAt: string;
  }>({ percentage: "", maxUses: "", timesUsed: "", expiresAt: "" });
  const [saving, setSaving] = useState(false);

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

  const startEditing = (c: DiscountCode) => {
    setEditingId(c.id);
    setEditFields({
      percentage: String(c.percentage),
      maxUses: c.maxUses !== null ? String(c.maxUses) : "",
      timesUsed: String(c.timesUsed),
      expiresAt: c.expiresAt || "",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          percentage: Number(editFields.percentage),
          maxUses: editFields.maxUses ? Number(editFields.maxUses) : null,
          timesUsed: Number(editFields.timesUsed),
          expiresAt: editFields.expiresAt || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to update code");
        return;
      }
      setEditingId(null);
      fetchCodes();
    } finally {
      setSaving(false);
    }
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
              <span></span>
            </div>
            {codes.map((c) => (
              <div key={c.id}>
                <div
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
                  <button
                    className={styles.editBtn}
                    onClick={() => editingId === c.id ? cancelEditing() : startEditing(c)}
                  >
                    {editingId === c.id ? "Cancel" : "Edit"}
                  </button>
                </div>
                {editingId === c.id && (
                  <div className={styles.editPanel}>
                    <div className={styles.editFields}>
                      <label className={styles.editLabel}>
                        <span>Discount %</span>
                        <input
                          className={styles.editInput}
                          type="number"
                          min="1"
                          max="100"
                          value={editFields.percentage}
                          onChange={(e) => setEditFields({ ...editFields, percentage: e.target.value })}
                        />
                      </label>
                      <label className={styles.editLabel}>
                        <span>Max Uses</span>
                        <input
                          className={styles.editInput}
                          type="number"
                          min="0"
                          placeholder="Unlimited"
                          value={editFields.maxUses}
                          onChange={(e) => setEditFields({ ...editFields, maxUses: e.target.value })}
                        />
                      </label>
                      <label className={styles.editLabel}>
                        <span>Times Used</span>
                        <div className={styles.usesRow}>
                          <input
                            className={styles.editInput}
                            type="number"
                            min="0"
                            value={editFields.timesUsed}
                            onChange={(e) => setEditFields({ ...editFields, timesUsed: e.target.value })}
                          />
                          <button
                            type="button"
                            className={styles.resetBtn}
                            onClick={() => setEditFields({ ...editFields, timesUsed: "0" })}
                          >
                            Reset
                          </button>
                        </div>
                      </label>
                      <label className={styles.editLabel}>
                        <span>Expires</span>
                        <input
                          className={styles.editInput}
                          type="date"
                          value={editFields.expiresAt}
                          onChange={(e) => setEditFields({ ...editFields, expiresAt: e.target.value })}
                        />
                      </label>
                    </div>
                    <button
                      className={styles.saveBtn}
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
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
