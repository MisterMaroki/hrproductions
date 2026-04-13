"use client";

import { useState, useEffect } from "react";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";
import { isWhiteLabel } from "@/lib/brand";

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

interface WhitelabelInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  bookingCount: number;
  generatedAt: string | null;
}

interface WhitelabelInvoicesResponse {
  brand: "whitelabel";
  uninvoicedTotal: number;
  invoices: WhitelabelInvoice[];
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PortalInvoicesPage() {
  const [data, setData] = useState<Invoice[] | WhitelabelInvoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const whitelabel = isWhiteLabel();

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <>
        <PortalNav />
        <main className={styles.main}>
          <div className={styles.container}>
            <p className={styles.empty}>Loading...</p>
          </div>
        </main>
      </>
    );
  }

  if (data && "brand" in data && data.brand === "whitelabel") {
    return (
      <>
        <PortalNav />
        <main className={styles.main}>
          <div className={styles.container}>
            <h1 className={styles.title}>Invoices</h1>

            <div className={styles.summaryCard}>
              <div className={styles.summaryLabel}>Un-invoiced total</div>
              <div className={styles.summaryValue}>{pence(data.uninvoicedTotal)}</div>
              <div className={styles.summaryNote}>
                This is the running total of confirmed shoots not yet invoiced.
              </div>
            </div>

            <h2 className={styles.subheading}>Past invoices</h2>
            {data.invoices.length === 0 ? (
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
                  {data.invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoiceNumber}</td>
                      <td>
                        {inv.generatedAt
                          ? new Date(inv.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td>{inv.bookingCount}</td>
                      <td style={{ textAlign: "right" }}>{pence(inv.totalAmount)}</td>
                      <td><a href={`/api/portal/whitelabel-invoice/${inv.id}/pdf`}>Download</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </>
    );
  }

  const invoices = (data as Invoice[] | null) ?? [];

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Invoices</h1>

          {invoices.length === 0 ? (
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
                      <span className={`${styles.badge} ${styles[`badge_${inv.status}` as keyof typeof styles] || ""}`}>{inv.status}</span>
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
