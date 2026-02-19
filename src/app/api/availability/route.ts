import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, blockedDays } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import {
  getAvailableSlots,
  isWorkingDay,
  type ExistingBooking,
} from "@/lib/scheduling";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const durationParam = searchParams.get("duration"); // shoot duration in minutes

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Valid date (YYYY-MM-DD) is required" },
      { status: 400 }
    );
  }

  try {
    // Reject Sundays
    if (!isWorkingDay(date)) {
      return NextResponse.json({
        available: false,
        reason: "We only operate Monday – Saturday",
        slots: [],
      });
    }

    const [blocked] = await db
      .select()
      .from(blockedDays)
      .where(eq(blockedDays.date, date))
      .limit(1);

    if (blocked) {
      return NextResponse.json({
        available: false,
        reason: blocked.reason || "This date is unavailable",
        slots: [],
      });
    }

    // Get existing bookings with time slots for this date
    const existing = await db
      .select({
        startTime: bookings.startTime,
        endTime: bookings.endTime,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.preferredDate, date),
          eq(bookings.status, "confirmed")
        )
      );

    const existingBookings: ExistingBooking[] = existing
      .filter((b) => b.startTime && b.endTime)
      .map((b) => ({
        startTime: b.startTime!,
        endTime: b.endTime!,
      }));

    // If duration provided, return available time slots
    const duration = durationParam ? parseInt(durationParam, 10) : 0;
    const slots = duration > 0
      ? getAvailableSlots(duration, existingBookings)
      : [];

    return NextResponse.json({
      available: slots.length > 0 || duration === 0,
      slots,
      existingBookings: existingBookings.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
