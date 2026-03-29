"use client";

import { useState, useEffect } from "react";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface InvoiceItem {
  id: string;
  bookingId: string;
  amount: number;
  address: string | null;
  postcode: string | null;
  preferredDate: string | null;
  services: string | null;
}

interface Invoice {
  id: string;
  totalAmount: number;
  status: string;
  chargedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  items: InvoiceItem[];
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((r) => r.json())
      .then((d) => { setInvoices(d); setLoading(false); });
  }, []);

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Invoices</h1>

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : invoices.length === 0 ? (
            <p className={styles.empty}>No invoices yet</p>
          ) : (
            <div className={styles.list}>
              {invoices.map((inv) => (
                <div key={inv.id} className={styles.card}>
                  <button
                    className={styles.cardHeader}
                    onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                  >
                    <div>
                      <p className={styles.cardDate}>{inv.chargedAt ? formatDate(inv.chargedAt) : "—"}</p>
                      <p className={styles.cardShoots}>{inv.items.length} shoot{inv.items.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className={styles.cardRight}>
                      <span className={styles.cardTotal}>{pence(inv.totalAmount)}</span>
                      <span className={`${styles.badge} ${styles[`badge_${inv.status}`] || ""}`}>{inv.status}</span>
                    </div>
                  </button>

                  {expandedId === inv.id && (
                    <div className={styles.cardBody}>
                      {inv.failureReason && (
                        <p className={styles.failureReason}>Payment failed: {inv.failureReason}</p>
                      )}
                      <table className={styles.itemsTable}>
                        <thead>
                          <tr><th>Address</th><th>Date</th><th>Amount</th></tr>
                        </thead>
                        <tbody>
                          {inv.items.map((item) => (
                            <tr key={item.id}>
                              <td>{item.address}{item.postcode ? `, ${item.postcode}` : ""}</td>
                              <td>{item.preferredDate ? formatDate(item.preferredDate) : "—"}</td>
                              <td>{pence(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <a href={`/api/portal/invoices/${inv.id}/pdf`} className={styles.downloadBtn}>Download PDF</a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
