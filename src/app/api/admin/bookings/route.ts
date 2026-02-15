import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [];

  if (from) conditions.push(gte(bookings.preferredDate, from));
  if (to) conditions.push(lte(bookings.preferredDate, to));

  const rows = await db
    .select()
    .from(bookings)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(bookings.preferredDate);

  return NextResponse.json(rows);
}

export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}
