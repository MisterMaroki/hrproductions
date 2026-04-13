"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";
import { isWhiteLabel } from "@/lib/brand";

interface Booking {
  id: string;
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  startTime: string | null;
  endTime: string | null;
  services: string;
  total: number;
  status: string;
}

type StatusFilter = "all" | "pending" | "completed" | "invoiced" | "paid" | "cancelled";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function parseServiceNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    const labels: string[] = [];
    if (parsed.photography) labels.push(`Photography (${parsed.photoCount ?? 20} photos)`);
    if (parsed.dronePhotography) labels.push("Drone Photography");
    if (parsed.standardVideo) labels.push("Standard Video");
    if (parsed.agentPresentedVideo) labels.push("Agent Presented Video");
    if (parsed.socialMediaVideo) labels.push("Social Media Video");
    if (parsed.socialMediaPresentedVideo) labels.push("Social Media Video (Presented)");
    if (parsed.standardFloorPlan) labels.push("Standard Floor Plan");
    if (parsed.premiumFloorPlan) labels.push("Premium Floor Plan");
    if (parsed.floorPlan3D) labels.push("3D Floor Plan");
    return labels.length > 0 ? labels : ["—"];
  } catch {
    return ["—"];
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
  payment_failed: "Payment Failed",
};

export default function PortalBookingsPage() {
  const whitelabel = isWhiteLabel();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/portal/bookings")
      .then((r) => r.json())
      .then((d) => { setBookings(d); setLoading(false); });
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    for (const b of bookings) { c[b.status] = (c[b.status] || 0) + 1; }
    return c;
  }, [bookings]);

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Bookings</h1>
            <Link href="/portal/bookings/new" className={styles.newBtn}>Book a Shoot</Link>
          </div>

          <div className={styles.tabs}>
            {(["all", "pending", "completed", "invoiced", "paid", "cancelled"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                className={`${styles.tab} ${filter === s ? styles.tabActive : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "All" : STATUS_LABELS[s] || s}
                {counts[s] !== undefined && <span className={styles.tabCount}>{counts[s]}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>No bookings found</p>
          ) : (
            <div className={styles.list}>
              {filtered.map((b) => {
                const services = parseServiceNames(b.services);
                const timeStr = b.startTime && b.endTime ? `${formatTime(b.startTime)} – ${formatTime(b.endTime)}` : null;
                return (
                  <div key={b.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <p className={styles.cardAddress}>{b.address}{b.postcode ? `, ${b.postcode}` : ""}</p>
                        <p className={styles.cardDate}>{formatDate(b.preferredDate)}{timeStr ? ` · ${timeStr}` : ""}</p>
                      </div>
                      <div className={styles.cardRight}>
                        <span className={styles.cardTotal}>{pence(b.total)}</span>
                        <span className={`${styles.badge} ${styles[`badge_${b.status}`] || ""}`}>
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardServices}>{services.join(" · ")}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
