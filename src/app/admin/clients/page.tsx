"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AdminNav from "../components/AdminNav";
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
  runningBalance: number;
  completedBookings: number;
}

type StatusFilter = "all" | "pending_approval" | "active" | "suspended" | "deactivated";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  pending_approval: "Pending Approval",
  active: "Active",
  suspended: "Suspended",
  deactivated: "Deactivated",
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const res = await fetch(`/api/admin/clients?${params}`);
    const data = await res.json();
    setClients(data);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return clients;
    return clients.filter((c) => c.status === statusFilter);
  }, [clients, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: clients.length,
      pending_approval: 0,
      active: 0,
      suspended: 0,
      deactivated: 0,
    };
    for (const c of clients) {
      if (c.status in counts) counts[c.status]++;
    }
    return counts;
  }, [clients]);

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Clients</h1>

          {/* Filters */}
          <div className={styles.filters}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search company name, email, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {/* Status tabs */}
            <div className={styles.statusTabs}>
              {(["all", "pending_approval", "active", "suspended", "deactivated"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={`${styles.statusTab} ${statusFilter === s ? styles.statusTabActive : ""}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {STATUS_LABELS[s]}
                  <span className={styles.statusCount}>{statusCounts[s] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <p className={styles.emptyMsg}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.emptyMsg}>No clients found</p>
          ) : (
            <div className={styles.results}>
              <p className={styles.resultCount}>
                {filtered.length} client{filtered.length !== 1 ? "s" : ""}
              </p>

              {filtered.map((c) => (
                <Link key={c.id} href={`/admin/clients/${c.id}`} className={styles.cardLink}>
                  <div className={styles.card}>
                    <div className={styles.cardLeft}>
                      <span className={styles.cardCompany}>{c.companyName}</span>
                      <span className={styles.cardContact}>{c.contactName} · {c.email}</span>
                    </div>
                    <div className={styles.cardRight}>
                      {c.runningBalance > 0 && (
                        <span className={styles.cardBalance}>
                          £{(c.runningBalance / 100).toFixed(2)} balance
                        </span>
                      )}
                      <span className={`${styles.cardMandate} ${c.gocardlessMandateId ? styles.mandateActive : styles.mandateNone}`}>
                        {c.gocardlessMandateId ? "Mandate" : "No mandate"}
                      </span>
                      <span className={`${styles.cardStatus} ${styles[`status_${c.status}`]}`}>
                        {STATUS_LABELS[c.status as StatusFilter] ?? c.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
