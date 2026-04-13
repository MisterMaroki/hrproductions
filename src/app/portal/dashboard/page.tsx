"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface DashboardData {
  client: {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    status: string;
    hasMandateSetup: boolean;
    bookingsPaused: boolean;
  };
  runningTotal: number;
  completedShootCount: number;
  pendingShootCount: number;
  totalPaidToDate: number;
}

interface WhitelabelDashboardData {
  brand: "whitelabel";
  companyName: string;
  upcomingCount: number;
  uninvoicedTotal: number;
  lastInvoiceAt: string | null;
  lastInvoiceNumber: string | null;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | WhitelabelDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <>
        <PortalNav />
        <main className={styles.main}>
          <p className={styles.loading}>Loading...</p>
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
            <div className={styles.titleArea}>
              <h1 className={styles.title}>Welcome back</h1>
              <p className={styles.companyLabel}>{data.companyName}</p>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Upcoming shoots</div>
                <div className={styles.statValue}>{data.upcomingCount}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Un-invoiced total</div>
                <div className={styles.statValue}>{pence(data.uninvoicedTotal)}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>Last invoice</div>
                <div className={styles.statValue}>
                  {data.lastInvoiceAt
                    ? new Date(data.lastInvoiceAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                    : "—"}
                </div>
                {data.lastInvoiceNumber && (
                  <div className={styles.statMeta}>{data.lastInvoiceNumber}</div>
                )}
              </div>
            </div>

            <div className={styles.actionsRow}>
              <Link href="/book" className={styles.primaryBtn}>New Booking</Link>
              <Link href="/portal/bookings" className={styles.secondaryBtn}>View Bookings</Link>
              <Link href="/portal/invoices" className={styles.secondaryBtn}>View Invoices</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const mainData = data as DashboardData;
  const { client } = mainData;

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Welcome back, {client.contactName.split(" ")[0]}</h1>
            <p className={styles.companyLabel}>{client.companyName}</p>
          </div>

          {client.status === "pending_approval" && (
            <div className={styles.bannerWarning}>
              Your account is pending approval. You&apos;ll be able to book shoots once your account is activated.
            </div>
          )}

          {client.status === "suspended" && (
            <div className={styles.bannerError}>
              Your account has been suspended. Please contact us for more information.
            </div>
          )}

          {client.status === "active" && !client.hasMandateSetup && (
            <div className={styles.bannerAction}>
              <span>Set up your payment method to start booking shoots.</span>
              <Link href="/portal/account/setup-mandate" className={styles.bannerBtn}>
                Set Up Payment
              </Link>
            </div>
          )}

          {client.bookingsPaused && (
            <div className={styles.bannerError}>
              Your booking ability is paused due to a failed payment. Please contact us to resolve this.
            </div>
          )}

          {client.status === "active" && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Running Total</span>
                <span className={styles.statValue}>{pence(mainData.runningTotal)}</span>
                <span className={styles.statSub}>
                  {mainData.completedShootCount} completed shoot{mainData.completedShootCount !== 1 ? "s" : ""} awaiting invoice
                </span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Upcoming Shoots</span>
                <span className={styles.statValue}>{mainData.pendingShootCount}</span>
                <span className={styles.statSub}>pending</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Paid</span>
                <span className={styles.statValue}>{pence(mainData.totalPaidToDate)}</span>
                <span className={styles.statSub}>to date</span>
              </div>
            </div>
          )}

          {client.status === "active" && client.hasMandateSetup && !client.bookingsPaused && (
            <div className={styles.actions}>
              <Link href="/portal/bookings/new" className={styles.primaryBtn}>Book a Shoot</Link>
              <Link href="/portal/bookings" className={styles.secondaryBtn}>View All Bookings</Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
