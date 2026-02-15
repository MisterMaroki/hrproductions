import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, blockedDays } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { MAX_DAILY_HOURS } from "@/lib/scheduling";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Valid date (YYYY-MM-DD) is required" },
      { status: 400 }
    );
  }

  try {
    const [blocked] = await db
      .select()
      .from(blockedDays)
      .where(eq(blockedDays.date, date))
      .limit(1);

    if (blocked) {
      return NextResponse.json({
        available: false,
        reason: blocked.reason || "This date is unavailable",
        hoursBooked: 0,
        hoursRemaining: 0,
      });
    }

    const [result] = await db
      .select({
        totalHours: sql<number>`COALESCE(SUM(${bookings.workHours}), 0)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.preferredDate, date),
          eq(bookings.status, "confirmed")
        )
      );

    const hoursBooked = result?.totalHours ?? 0;
    const hoursRemaining = Math.max(0, MAX_DAILY_HOURS - hoursBooked);

    return NextResponse.json({
      available: hoursRemaining > 0,
      hoursBooked,
      hoursRemaining,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
