"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface PendingBooking {
  id: string;
  address: string;
  postcode: string | null;
  preferredDate: string;
  agentName: string;
  agentCompany: string | null;
  total: number;
  services: string;
}

interface PastInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  bookingCount: number;
  generatedAt: string | null;
}

function pence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function WhitelabelInvoicePage() {
  const [pending, setPending] = useState<PendingBooking[]>([]);
  const [past, setPast] = useState<PastInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/whitelabel-invoice");
    if (res.ok) {
      const data = await res.json();
      setPending(data.pending);
      setPast(data.past);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = pending.reduce((sum, b) => sum + b.total, 0);

  const handleGenerate = useCallback(async () => {
    if (!pending.length) return;
    if (!confirm(`Generate invoice for ${pending.length} bookings — ${pence(total)}?`)) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/whitelabel-invoice/generate", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] || "invoice.pdf";
      a.click();
      URL.revokeObjectURL(url);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }, [pending, total, load]);

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Whitelabel Invoicing</h1>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.subheading}>Un-invoiced bookings</h2>
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating || pending.length === 0}
            >
              {generating ? "Generating..." : `Generate Invoice PDF (${pence(total)})`}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : pending.length === 0 ? (
            <p className={styles.empty}>No un-invoiced bookings.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Address</th>
                  <th>Booked by</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.preferredDate)}</td>
                    <td>{b.address}{b.postcode ? `, ${b.postcode}` : ""}</td>
                    <td>{b.agentName}{b.agentCompany ? ` · ${b.agentCompany}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{pence(b.total)}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td style={{ textAlign: "right" }}><strong>{pence(total)}</strong></td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.subheading}>Past invoices</h2>
          {past.length === 0 ? (
            <p className={styles.empty}>None yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Bookings</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {past.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.generatedAt ? formatDate(inv.generatedAt.slice(0, 10)) : "—"}</td>
                    <td>{inv.bookingCount}</td>
                    <td style={{ textAlign: "right" }}>{pence(inv.totalAmount)}</td>
                    <td><a href={`/api/admin/whitelabel-invoice/${inv.id}/pdf`}>Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
