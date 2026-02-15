"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface Booking {
  id: string;
  address: string;
  bedrooms: number;
  preferredDate: string;
  agentName: string;
  agentEmail: string;
  workHours: number;
  total: number;
  status: string;
  services: string;
}

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

const MAX_DAILY_HOURS = 6;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    const [bookingsRes, blockedRes] = await Promise.all([
      fetch(`/api/admin/bookings?from=${monthStart}&to=${monthEnd}`),
      fetch("/api/admin/blocked-days"),
    ]);
    setBookings(await bookingsRes.json());
    setBlockedDays(await blockedRes.json());
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const bookingsForDate = (date: string) =>
    bookings.filter((b) => b.preferredDate === date && b.status === "confirmed");

  const hoursForDate = (date: string) =>
    bookingsForDate(date).reduce((sum, b) => sum + b.workHours, 0);

  const isBlocked = (date: string) =>
    blockedDays.some((d) => d.date === date);

  const handleBlockDay = async () => {
    if (!selectedDate) return;
    await fetch("/api/admin/blocked-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, reason: blockReason }),
    });
    setBlockReason("");
    fetchData();
  };

  const handleUnblockDay = async (id: string) => {
    await fetch("/api/admin/blocked-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  const firstDay = getFirstDayOfWeek(year, month);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedBookings = selectedDate ? bookingsForDate(selectedDate) : [];
  const selectedBlocked = selectedDate
    ? blockedDays.find((d) => d.date === selectedDate)
    : null;

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.calendarHeader}>
            <button className={styles.navBtn} onClick={prevMonth}>&larr;</button>
            <h2 className={styles.monthTitle}>
              {monthNames[month]} {year}
            </h2>
            <button className={styles.navBtn} onClick={nextMonth}>&rarr;</button>
          </div>

          <div className={styles.grid}>
            {dayNames.map((d) => (
              <div key={d} className={styles.dayHeader}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className={styles.emptyCell} />;

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hours = hoursForDate(dateStr);
              const blocked = isBlocked(dateStr);
              const isSelected = selectedDate === dateStr;
              const capacity = hours / MAX_DAILY_HOURS;

              let cellClass = styles.dayCell;
              if (blocked) cellClass += ` ${styles.blocked}`;
              else if (capacity >= 1) cellClass += ` ${styles.full}`;
              else if (capacity > 0) cellClass += ` ${styles.partial}`;
              if (isSelected) cellClass += ` ${styles.selected}`;

              return (
                <button
                  key={dateStr}
                  className={cellClass}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                >
                  <span className={styles.dayNumber}>{day}</span>
                  {hours > 0 && (
                    <span className={styles.hoursLabel}>{hours}h</span>
                  )}
                  {blocked && <span className={styles.blockedLabel}>Blocked</span>}
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className={styles.detail}>
              <h3 className={styles.detailTitle}>{selectedDate}</h3>

              {selectedBlocked ? (
                <div className={styles.blockedDetail}>
                  <p>Blocked{selectedBlocked.reason ? `: ${selectedBlocked.reason}` : ""}</p>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleUnblockDay(selectedBlocked.id)}
                  >
                    Unblock
                  </button>
                </div>
              ) : (
                <div className={styles.blockForm}>
                  <input
                    className={styles.blockInput}
                    type="text"
                    placeholder="Reason (optional)"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                  <button className={styles.actionBtn} onClick={handleBlockDay}>
                    Block Day
                  </button>
                </div>
              )}

              {selectedBookings.length > 0 ? (
                <div className={styles.bookingList}>
                  <h4 className={styles.bookingListTitle}>
                    Bookings ({hoursForDate(selectedDate)}h / {MAX_DAILY_HOURS}h)
                  </h4>
                  {selectedBookings.map((b) => (
                    <div key={b.id} className={styles.bookingCard}>
                      <p className={styles.bookingAddress}>{b.address}</p>
                      <p className={styles.bookingAgent}>{b.agentName} — {b.agentEmail}</p>
                      <p className={styles.bookingMeta}>
                        {b.workHours}h · {b.bedrooms}-bed · £{(b.total / 100).toFixed(2)}
                      </p>
                      <div className={styles.statusBtns}>
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
                    </div>
                  ))}
                </div>
              ) : !selectedBlocked ? (
                <p className={styles.noBookings}>No bookings for this date</p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
