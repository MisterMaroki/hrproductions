"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface Booking {
  id: string;
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  agentName: string;
  agentCompany: string | null;
  agentEmail: string;
  agentPhone: string | null;
  services: string;
  workHours: number;
  subtotal: number;
  discountCode: string | null;
  discountAmount: number | null;
  total: number;
  stripeSession: string | null;
  status: string;
  createdAt: string | null;
}

type StatusFilter = "all" | "confirmed" | "pending" | "completed" | "cancelled";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function parseServices(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s: { name?: string }) => s.name ?? String(s));
    }
    // Could be an object with boolean flags
    const labels: string[] = [];
    if (parsed.photography) labels.push(`Photography (${parsed.photoCount ?? 20} photos)`);
    if (parsed.dronePhotography) labels.push(`Drone Photography (${parsed.dronePhotoCount ?? 8})`);
    if (parsed.standardVideo) labels.push("Standard Video" + (parsed.standardVideoDrone ? " + Drone" : ""));
    if (parsed.agentPresentedVideo) labels.push("Agent Presented Video" + (parsed.agentPresentedVideoDrone ? " + Drone" : ""));
    if (parsed.socialMediaVideo) labels.push("Social Media Video (Unpresented)");
    if (parsed.socialMediaPresentedVideo) labels.push("Social Media Video (Presented)");
    if (parsed.standardFloorPlan) labels.push("Standard Floor Plan");
    if (parsed.premiumFloorPlan) labels.push("Premium Floor Plan");
    if (parsed.floorPlan3D) labels.push("3D Floor Plan");
    return labels.length > 0 ? labels : [raw];
  } catch {
    return [raw];
  }
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const res = await fetch(`/api/admin/bookings?${params}`);
    const data = await res.json();
    setBookings(data);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchBookings();
  };

  const filtered = useMemo(() => {
    let list = bookings;

    if (statusFilter !== "all") {
      list = list.filter((b) => b.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.address.toLowerCase().includes(q) ||
          (b.postcode && b.postcode.toLowerCase().includes(q)) ||
          b.agentName.toLowerCase().includes(q) ||
          (b.agentCompany && b.agentCompany.toLowerCase().includes(q)) ||
          b.agentEmail.toLowerCase().includes(q)
      );
    }

    return list;
  }, [bookings, statusFilter, search]);

  // Group bookings by date
  const grouped = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of filtered) {
      const existing = map.get(b.preferredDate);
      if (existing) existing.push(b);
      else map.set(b.preferredDate, [b]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const statusCounts = useMemo(() => {
    const counts = { all: bookings.length, confirmed: 0, pending: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) {
      if (b.status in counts) counts[b.status as keyof typeof counts]++;
    }
    return counts;
  }, [bookings]);

  const quickFilter = (preset: "today" | "week" | "month" | "all") => {
    const today = new Date();
    switch (preset) {
      case "today":
        setDateFrom(toDateInputValue(today));
        setDateTo(toDateInputValue(today));
        break;
      case "week": {
        const end = new Date(today);
        end.setDate(end.getDate() + 6);
        setDateFrom(toDateInputValue(today));
        setDateTo(toDateInputValue(end));
        break;
      }
      case "month": {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateFrom(toDateInputValue(start));
        setDateTo(toDateInputValue(end));
        break;
      }
      case "all":
        setDateFrom("");
        setDateTo("");
        break;
    }
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Bookings</h1>

          {/* Filters */}
          <div className={styles.filters}>
            {/* Search */}
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search agent, address, postcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Date range */}
            <div className={styles.dateRow}>
              <div className={styles.dateInputs}>
                <label className={styles.dateLabel}>
                  From
                  <input
                    className={styles.dateInput}
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </label>
                <label className={styles.dateLabel}>
                  To
                  <input
                    className={styles.dateInput}
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </label>
              </div>
              <div className={styles.quickFilters}>
                <button className={styles.quickBtn} onClick={() => quickFilter("today")}>Today</button>
                <button className={styles.quickBtn} onClick={() => quickFilter("week")}>This Week</button>
                <button className={styles.quickBtn} onClick={() => quickFilter("month")}>This Month</button>
                <button className={styles.quickBtn} onClick={() => quickFilter("all")}>All</button>
              </div>
            </div>

            {/* Status tabs */}
            <div className={styles.statusTabs}>
              {(["all", "confirmed", "pending", "completed", "cancelled"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  <span className={styles.statusCount}>{statusCounts[s]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <p className={styles.emptyMsg}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyMsg}>No bookings found</p>
          ) : (
            <div className={styles.results}>
              <p className={styles.resultCount}>
                {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
                {grouped.length > 0 ? ` across ${grouped.length} date${grouped.length !== 1 ? "s" : ""}` : ""}
              </p>

              {grouped.map(([date, dateBookings]) => (
                <div key={date} className={styles.dateGroup}>
                  <div className={styles.dateHeader}>
                    <span className={styles.dateHeaderText}>{formatDate(date)}</span>
                    <span className={styles.dateHeaderCount}>
                      {dateBookings.length} booking{dateBookings.length !== 1 ? "s" : ""}
                      {" · "}
                      {dateBookings.reduce((s, b) => s + b.workHours, 0).toFixed(1)}h
                    </span>
                  </div>

                  {dateBookings.map((b) => {
                    const isExpanded = expandedId === b.id;
                    const services = parseServices(b.services);
                    const timeStr =
                      b.startTime && b.endTime
                        ? `${formatTime(b.startTime)} – ${formatTime(b.endTime)}`
                        : b.startTime
                          ? formatTime(b.startTime)
                          : null;

                    return (
                      <div key={b.id} className={`${styles.card} ${b.status === "pending" ? styles.cardPending : ""} ${b.status === "cancelled" ? styles.cardCancelled : ""}`}>
                        <button
                          className={styles.cardHeader}
                          onClick={() => setExpandedId(isExpanded ? null : b.id)}
                        >
                          <div className={styles.cardLeft}>
                            <span className={styles.cardAddress}>
                              {b.address}{b.postcode ? `, ${b.postcode}` : ""}
                            </span>
                            <span className={styles.cardAgent}>{b.agentName}{b.agentCompany ? ` · ${b.agentCompany}` : ""}</span>
                          </div>
                          <div className={styles.cardRight}>
                            <span className={styles.cardTotal}>£{(b.total / 100).toFixed(2)}</span>
                            <span className={`${styles.cardStatus} ${styles[`status_${b.status}`]}`}>
                              {b.status}
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className={styles.cardBody}>
                            <div className={styles.detailGrid}>
                              {/* Left column */}
                              <div>
                                <div className={styles.detailSection}>
                                  <h4 className={styles.detailLabel}>Agent</h4>
                                  <p className={styles.detailValue}>{b.agentName}</p>
                                  {b.agentCompany && <p className={styles.detailValueSub}>{b.agentCompany}</p>}
                                  <p className={styles.detailValueSub}>{b.agentEmail}</p>
                                  {b.agentPhone && <p className={styles.detailValueSub}>{b.agentPhone}</p>}
                                </div>

                                <div className={styles.detailSection}>
                                  <h4 className={styles.detailLabel}>Property</h4>
                                  <p className={styles.detailValue}>{b.address}{b.postcode ? `, ${b.postcode}` : ""}</p>
                                  <p className={styles.detailValueSub}>{b.bedrooms}-bed</p>
                                </div>

                                {b.notes && (
                                  <div className={styles.detailSection}>
                                    <h4 className={styles.detailLabel}>Notes</h4>
                                    <p className={styles.detailValueSub}>{b.notes}</p>
                                  </div>
                                )}
                              </div>

                              {/* Right column */}
                              <div>
                                <div className={styles.detailSection}>
                                  <h4 className={styles.detailLabel}>Schedule</h4>
                                  <p className={styles.detailValue}>{formatDate(b.preferredDate)}</p>
                                  {timeStr && <p className={styles.detailValueSub}>{timeStr}</p>}
                                  <p className={styles.detailValueSub}>{b.workHours}h duration</p>
                                </div>

                                <div className={styles.detailSection}>
                                  <h4 className={styles.detailLabel}>Services</h4>
                                  {services.map((s, i) => (
                                    <p key={i} className={styles.detailValueSub}>{s}</p>
                                  ))}
                                </div>

                                <div className={styles.detailSection}>
                                  <h4 className={styles.detailLabel}>Pricing</h4>
                                  <p className={styles.detailValueSub}>Subtotal: £{(b.subtotal / 100).toFixed(2)}</p>
                                  {b.discountCode && (
                                    <p className={styles.detailValueSub}>
                                      Discount ({b.discountCode}): -£{((b.discountAmount ?? 0) / 100).toFixed(2)}
                                    </p>
                                  )}
                                  <p className={styles.detailValue}>Total: £{(b.total / 100).toFixed(2)}</p>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className={styles.cardActions}>
                              <div className={styles.statusBtns}>
                                <button
                                  className={`${styles.statusBtn} ${b.status === "confirmed" ? styles.statusActive : ""}`}
                                  onClick={() => handleUpdateStatus(b.id, "confirmed")}
                                >
                                  Confirmed
                                </button>
                                <button
                                  className={`${styles.statusBtn} ${b.status === "completed" ? styles.statusActive : ""}`}
                                  onClick={() => handleUpdateStatus(b.id, "completed")}
                                >
                                  Complete
                                </button>
                                <button
                                  className={`${styles.statusBtn} ${styles.cancelBtn} ${b.status === "cancelled" ? styles.statusActive : ""}`}
                                  onClick={() => handleUpdateStatus(b.id, "cancelled")}
                                >
                                  Cancel
                                </button>
                              </div>
                              {b.stripeSession && (
                                <a
                                  href={`https://dashboard.stripe.com/checkout/sessions/${b.stripeSession}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.stripeLink}
                                >
                                  View in Stripe &rarr;
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
