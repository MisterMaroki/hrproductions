"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AdminNav from "../../components/AdminNav";
import styles from "./page.module.css";

interface Client {
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

interface Booking {
  id: string;
  address: string;
  postcode: string | null;
  preferredDate: string;
  services: string;
  total: number;
  status: string;
  createdAt: string | null;
}

interface Invoice {
  id: string;
  totalAmount: number;
  status: string;
  pdfPath: string | null;
  failureReason: string | null;
  chargedAt: string | null;
  createdAt: string | null;
}

interface ClientDetail {
  client: Client;
  completedBookings: Booking[];
  runningBalance: number;
  allBookings: Booking[];
  invoices: Invoice[];
}

type BookingStatusFilter = "all" | "confirmed" | "pending" | "completed" | "invoiced" | "cancelled";

const BOOKING_STATUS_LABELS: Record<BookingStatusFilter, string> = {
  all: "All",
  confirmed: "Confirmed",
  pending: "Pending",
  completed: "Completed",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

const CLIENT_STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending Approval",
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseServices(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s: { name?: string }) => s.name ?? String(s));
    }
    const labels: string[] = [];
    if (parsed.photography) labels.push(`Photography (${parsed.photoCount ?? 20})`);
    if (parsed.dronePhotography) labels.push("Drone Photography");
    if (parsed.standardVideo) labels.push("Standard Video");
    if (parsed.agentPresentedVideo) labels.push("Agent Presented Video");
    if (parsed.socialMediaVideo) labels.push("Social Media Video");
    if (parsed.standardFloorPlan) labels.push("Standard Floor Plan");
    if (parsed.premiumFloorPlan) labels.push("Premium Floor Plan");
    if (parsed.floorPlan3D) labels.push("3D Floor Plan");
    return labels.length > 0 ? labels : [raw];
  } catch {
    return [raw];
  }
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Running balance checkboxes
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [charging, setCharging] = useState(false);
  const [chargeSuccess, setChargeSuccess] = useState<string | null>(null);
  const [chargeError, setChargeError] = useState<string | null>(null);

  // Booking history filter
  const [bookingFilter, setBookingFilter] = useState<BookingStatusFilter>("all");

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  // Retry loading
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/clients/${id}`);
    if (!res.ok) {
      setError("Client not found");
      setLoading(false);
      return;
    }
    const json: ClientDetail = await res.json();
    setData(json);
    // Default: all completed bookings checked
    setCheckedIds(new Set(json.completedBookings.map((b) => b.id)));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await fetchData();
    setActionLoading(false);
  };

  const handleCharge = async () => {
    if (checkedIds.size === 0) return;
    setCharging(true);
    setChargeError(null);
    setChargeSuccess(null);

    const res = await fetch(`/api/admin/clients/${id}/charge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingIds: Array.from(checkedIds) }),
    });

    const json = await res.json();
    if (res.ok) {
      setChargeSuccess(`Charge of £${(json.totalAmount / 100).toFixed(2)} initiated for ${json.bookingsCharged} booking${json.bookingsCharged !== 1 ? "s" : ""}.`);
      await fetchData();
    } else {
      setChargeError(json.error ?? "Failed to process charge");
    }
    setCharging(false);
  };

  const handleRetry = async (invoiceId: string) => {
    setRetryingId(invoiceId);
    const res = await fetch(`/api/admin/invoices/${invoiceId}/retry`, { method: "POST" });
    const json = await res.json();
    setRetryMsg((prev) => ({
      ...prev,
      [invoiceId]: res.ok ? "Retry initiated" : (json.error ?? "Failed"),
    }));
    setRetryingId(null);
    if (res.ok) fetchData();
  };

  const checkedTotal = useMemo(() => {
    if (!data) return 0;
    return data.completedBookings
      .filter((b) => checkedIds.has(b.id))
      .reduce((s, b) => s + b.total, 0);
  }, [data, checkedIds]);

  const filteredBookings = useMemo(() => {
    if (!data) return [];
    if (bookingFilter === "all") return data.allBookings;
    return data.allBookings.filter((b) => b.status === bookingFilter);
  }, [data, bookingFilter]);

  const bookingStatusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: data?.allBookings.length ?? 0,
      confirmed: 0,
      pending: 0,
      completed: 0,
      invoiced: 0,
      cancelled: 0,
    };
    for (const b of data?.allBookings ?? []) {
      if (b.status in counts) counts[b.status]++;
    }
    return counts;
  }, [data]);

  if (loading) {
    return (
      <>
        <AdminNav />
        <main className={styles.main}>
          <div className={styles.container}>
            <p className={styles.emptyMsg}>Loading...</p>
          </div>
        </main>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <AdminNav />
        <main className={styles.main}>
          <div className={styles.container}>
            <p className={styles.emptyMsg}>{error ?? "Something went wrong"}</p>
          </div>
        </main>
      </>
    );
  }

  const { client, completedBookings, runningBalance, invoices } = data;

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          {/* Breadcrumb */}
          <div className={styles.breadcrumb}>
            <a href="/admin/clients" className={styles.breadcrumbLink}>Clients</a>
            <span className={styles.breadcrumbSep}>/</span>
            <span>{client.companyName}</span>
          </div>

          <h1 className={styles.title}>{client.companyName}</h1>

          {/* ─── Overview Section ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Overview</h2>

            <div className={styles.overviewGrid}>
              {/* Company & Contact */}
              <div className={styles.overviewBlock}>
                <div className={styles.detailSection}>
                  <h4 className={styles.detailLabel}>Company</h4>
                  <p className={styles.detailValue}>{client.companyName}</p>
                </div>
                <div className={styles.detailSection}>
                  <h4 className={styles.detailLabel}>Contact</h4>
                  <p className={styles.detailValue}>{client.contactName}</p>
                  <p className={styles.detailValueSub}>{client.email}</p>
                  <p className={styles.detailValueSub}>{client.phone}</p>
                </div>
                <div className={styles.detailSection}>
                  <h4 className={styles.detailLabel}>Account Status</h4>
                  <span className={`${styles.statusBadge} ${styles[`clientStatus_${client.status}`]}`}>
                    {CLIENT_STATUS_LABELS[client.status] ?? client.status}
                  </span>
                </div>
                <div className={styles.detailSection}>
                  <h4 className={styles.detailLabel}>GoCardless Mandate</h4>
                  {client.gocardlessMandateId ? (
                    <span className={`${styles.statusBadge} ${styles.mandateActive}`}>
                      Active — {client.gocardlessMandateId}
                    </span>
                  ) : (
                    <span className={`${styles.statusBadge} ${styles.mandateNone}`}>
                      Not set up
                    </span>
                  )}
                </div>
                {client.bookingsPaused === 1 && (
                  <div className={styles.detailSection}>
                    <h4 className={styles.detailLabel}>Bookings</h4>
                    <div className={styles.pausedRow}>
                      <span className={styles.pausedBadge}>Paused</span>
                      <button
                        className={styles.actionBtn}
                        disabled={actionLoading}
                        onClick={() => handleAction({ unpauseBookings: true })}
                      >
                        Unpause
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className={styles.overviewBlock}>
                <h4 className={styles.detailLabel}>Actions</h4>
                <div className={styles.actionBtns}>
                  {client.status === "pending_approval" && (
                    <button
                      className={`${styles.actionBtn} ${styles.approveBtn}`}
                      disabled={actionLoading}
                      onClick={() => handleAction({ status: "active" })}
                    >
                      Approve Account
                    </button>
                  )}
                  {client.status === "active" && (
                    <button
                      className={`${styles.actionBtn} ${styles.suspendBtn}`}
                      disabled={actionLoading}
                      onClick={() => handleAction({ status: "suspended" })}
                    >
                      Suspend
                    </button>
                  )}
                  {(client.status === "active" || client.status === "suspended") && (
                    <button
                      className={`${styles.actionBtn} ${styles.deactivateBtn}`}
                      disabled={actionLoading}
                      onClick={() => handleAction({ status: "deactivated" })}
                    >
                      Deactivate
                    </button>
                  )}
                  {(client.status === "suspended" || client.status === "deactivated") && (
                    <button
                      className={`${styles.actionBtn} ${styles.reactivateBtn}`}
                      disabled={actionLoading}
                      onClick={() => handleAction({ status: "active" })}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
                {client.createdAt && (
                  <p className={styles.detailValueSub} style={{ marginTop: "1rem" }}>
                    Member since {formatDate(client.createdAt.split("T")[0])}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ─── Running Balance Section ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>
              Running Balance
              <span className={styles.sectionMeta}>
                £{(runningBalance / 100).toFixed(2)} total
              </span>
            </h2>

            {completedBookings.length === 0 ? (
              <p className={styles.emptyMsg}>No completed bookings awaiting charge</p>
            ) : (
              <>
                <div className={styles.balanceList}>
                  {completedBookings.map((b) => (
                    <label key={b.id} className={styles.balanceRow}>
                      <input
                        type="checkbox"
                        className={styles.checkbox}
                        checked={checkedIds.has(b.id)}
                        onChange={(e) => {
                          const next = new Set(checkedIds);
                          if (e.target.checked) next.add(b.id);
                          else next.delete(b.id);
                          setCheckedIds(next);
                        }}
                      />
                      <div className={styles.balanceRowInfo}>
                        <span className={styles.balanceAddr}>
                          {b.address}{b.postcode ? `, ${b.postcode}` : ""}
                        </span>
                        <span className={styles.balanceMeta}>
                          {formatDate(b.preferredDate)} · {parseServices(b.services).join(", ")}
                        </span>
                      </div>
                      <span className={styles.balanceAmount}>
                        £{(b.total / 100).toFixed(2)}
                      </span>
                    </label>
                  ))}
                </div>

                <div className={styles.chargeRow}>
                  <div>
                    <span className={styles.chargeTotalLabel}>Selected total: </span>
                    <span className={styles.chargeTotal}>£{(checkedTotal / 100).toFixed(2)}</span>
                    <span className={styles.chargeCount}>
                      {" "}({checkedIds.size} booking{checkedIds.size !== 1 ? "s" : ""})
                    </span>
                  </div>
                  <button
                    className={`${styles.chargeBtn} ${checkedIds.size === 0 ? styles.chargeBtnDisabled : ""}`}
                    disabled={charging || checkedIds.size === 0}
                    onClick={handleCharge}
                  >
                    {charging ? "Processing..." : `Charge £${(checkedTotal / 100).toFixed(2)}`}
                  </button>
                </div>

                {chargeSuccess && (
                  <p className={styles.successMsg}>{chargeSuccess}</p>
                )}
                {chargeError && (
                  <p className={styles.errorMsg}>{chargeError}</p>
                )}
              </>
            )}
          </section>

          {/* ─── Booking History Section ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Booking History</h2>

            {/* Status tabs */}
            <div className={styles.statusTabs}>
              {(["all", "confirmed", "pending", "completed", "invoiced", "cancelled"] as BookingStatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusTab} ${bookingFilter === s ? styles.statusTabActive : ""}`}
                  onClick={() => setBookingFilter(s)}
                >
                  {BOOKING_STATUS_LABELS[s]}
                  <span className={styles.statusCount}>{bookingStatusCounts[s] ?? 0}</span>
                </button>
              ))}
            </div>

            {filteredBookings.length === 0 ? (
              <p className={styles.emptyMsg}>No bookings found</p>
            ) : (
              <div className={styles.bookingList}>
                {filteredBookings.map((b) => (
                  <div key={b.id} className={styles.bookingCard}>
                    <div className={styles.bookingCardLeft}>
                      <span className={styles.bookingAddr}>
                        {b.address}{b.postcode ? `, ${b.postcode}` : ""}
                      </span>
                      <span className={styles.bookingMeta}>
                        {formatDate(b.preferredDate)} · {parseServices(b.services).join(", ")}
                      </span>
                    </div>
                    <div className={styles.bookingCardRight}>
                      <span className={styles.bookingTotal}>£{(b.total / 100).toFixed(2)}</span>
                      <span className={`${styles.bookingStatus} ${styles[`bStatus_${b.status}`]}`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ─── Invoice History Section ─── */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Invoice History</h2>

            {invoices.length === 0 ? (
              <p className={styles.emptyMsg}>No invoices found</p>
            ) : (
              <div className={styles.invoiceList}>
                {invoices.map((inv) => (
                  <div key={inv.id} className={styles.invoiceCard}>
                    <div className={styles.invoiceLeft}>
                      <span className={styles.invoiceId}>INV-{inv.id.slice(0, 8).toUpperCase()}</span>
                      <span className={styles.invoiceMeta}>
                        {inv.chargedAt ? formatDate(inv.chargedAt.split("T")[0]) : "—"}
                        {inv.failureReason && ` · ${inv.failureReason}`}
                      </span>
                    </div>
                    <div className={styles.invoiceRight}>
                      <span className={styles.invoiceAmount}>£{(inv.totalAmount / 100).toFixed(2)}</span>
                      <span className={`${styles.invoiceStatus} ${styles[`invStatus_${inv.status}`]}`}>
                        {inv.status}
                      </span>
                      {inv.pdfPath && (
                        <a
                          href={`/api/admin/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.pdfLink}
                        >
                          PDF
                        </a>
                      )}
                      {inv.status === "failed" && (
                        <button
                          className={styles.retryBtn}
                          disabled={retryingId === inv.id}
                          onClick={() => handleRetry(inv.id)}
                        >
                          {retryingId === inv.id ? "Retrying..." : "Retry"}
                        </button>
                      )}
                      {retryMsg[inv.id] && (
                        <span className={styles.retryMsg}>{retryMsg[inv.id]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
