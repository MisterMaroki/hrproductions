import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./DatePicker.module.css";

interface Props {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  error?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function getMonthKey(y: number, m: number) {
  return `${y}-${pad(m + 1)}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DatePicker({ value, onChange, error }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const initial = value ? new Date(value + "T12:00:00") : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const fetchUnavailable = useCallback(async (y: number, m: number) => {
    const key = getMonthKey(y, m);
    setLoading(true);
    try {
      const res = await fetch(`/api/availability/month?month=${key}`);
      const data = await res.json();
      setUnavailable(new Set(data.unavailable || []));
    } catch {
      setUnavailable(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchUnavailable(viewYear, viewMonth);
    }
  }, [viewYear, viewMonth, open, fetchUnavailable]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Can't go before current month
  const canGoPrev =
    viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  // Build calendar grid (Mon-start weeks)
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // getDay(): 0=Sun, 1=Mon... We want Mon=0, Sun=6
  const startDow = (firstOfMonth.getDay() + 6) % 7;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isDisabled = (day: number) => {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    const date = new Date(viewYear, viewMonth, day);
    // Past or today
    if (date < tomorrow) return true;
    // Sunday (getDay() === 0)
    if (date.getDay() === 0) return true;
    // Blocked or fully booked
    if (unavailable.has(dateStr)) return true;
    return false;
  };

  const formatDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={`${styles.trigger} ${error ? styles.triggerError : ""}`}
        onClick={() => setOpen(!open)}
        {...(error ? { "data-validation-error": true } : {})}
      >
        {value ? formatDisplay(value) : "Select a date…"}
        <span className={styles.caret}>{open ? "\u25B2" : "\u25BC"}</span>
      </button>
      {error && <span className={styles.error}>{error}</span>}

      {open && (
        <div className={styles.dropdown} onClick={(e) => e.stopPropagation()}>
          <div className={styles.nav}>
            <button
              type="button"
              className={styles.navBtn}
              onClick={prevMonth}
              disabled={!canGoPrev}
            >
              &larr;
            </button>
            <span className={styles.monthLabel}>
              {loading ? "Loading…" : monthLabel}
            </span>
            <button type="button" className={styles.navBtn} onClick={nextMonth}>
              &rarr;
            </button>
          </div>

          <div className={styles.grid}>
            {DAY_LABELS.map((d) => (
              <span key={d} className={styles.dayLabel}>{d}</span>
            ))}
            {cells.map((day, i) => {
              if (day === null) {
                return <span key={`empty-${i}`} className={styles.empty} />;
              }
              const dateStr = toDateStr(viewYear, viewMonth, day);
              const disabled = isDisabled(day);
              const selected = dateStr === value;
              return (
                <button
                  key={dateStr}
                  type="button"
                  className={`${styles.day} ${selected ? styles.selected : ""} ${disabled ? styles.disabled : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(dateStr);
                    setOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
