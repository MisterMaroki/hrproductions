import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, blockedDays } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { DAY_START, DAY_END } from "@/lib/scheduling";

/**
 * GET /api/availability/month?month=2026-02
 *
 * Returns dates in the given month that are unavailable:
 * - blocked days (manually blocked by admin)
 * - fully booked days (no gaps left in 9am–6pm)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // YYYY-MM

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Valid month (YYYY-MM) is required" },
      { status: 400 }
    );
  }

  const [year, mon] = month.split("-").map(Number);
  const firstDay = `${month}-01`;
  const lastDay = `${month}-${String(new Date(year, mon, 0).getDate()).padStart(2, "0")}`;

  try {
    // Get blocked days for this month
    const blocked = await db
      .select({ date: blockedDays.date })
      .from(blockedDays)
      .where(and(gte(blockedDays.date, firstDay), lte(blockedDays.date, lastDay)));

    const blockedSet = new Set(blocked.map((b) => b.date));

    // Get all confirmed bookings with time slots for this month
    const monthBookings = await db
      .select({
        date: bookings.preferredDate,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          gte(bookings.preferredDate, firstDay),
          lte(bookings.preferredDate, lastDay),
          eq(bookings.status, "confirmed")
        )
      );

    // Group bookings by date and check if any 30-min gap exists
    const bookingsByDate = new Map<string, { start: number; end: number }[]>();
    for (const b of monthBookings) {
      if (!b.startTime || !b.endTime) continue;
      const [sh, sm] = b.startTime.split(":").map(Number);
      const [eh, em] = b.endTime.split(":").map(Number);
      const arr = bookingsByDate.get(b.date) || [];
      arr.push({ start: sh * 60 + sm, end: eh * 60 + em });
      bookingsByDate.set(b.date, arr);
    }

    // A day is "full" if there isn't even a 30-min gap in the working day
    const MIN_SLOT = 30;
    const TRAVEL = 30;
    const fullDates = new Set<string>();

    for (const [date, slots] of bookingsByDate) {
      const sorted = slots.sort((a, b) => a.start - b.start);
      let cursor = DAY_START;
      let hasFreeSlot = false;

      for (const slot of sorted) {
        const gapStart = cursor;
        const gapEnd = slot.start - TRAVEL; // need travel buffer before next booking
        if (gapEnd - gapStart >= MIN_SLOT) {
          hasFreeSlot = true;
          break;
        }
        cursor = Math.max(cursor, slot.end + TRAVEL);
      }

      if (!hasFreeSlot && DAY_END - cursor >= MIN_SLOT) {
        hasFreeSlot = true;
      }

      if (!hasFreeSlot) {
        fullDates.add(date);
      }
    }

    // Combine blocked + full dates
    const unavailable = [
      ...Array.from(blockedSet),
      ...Array.from(fullDates).filter((d) => !blockedSet.has(d)),
    ].sort();

    return NextResponse.json({ unavailable });
  } catch {
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
