import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isWhiteLabel()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await getWhitelabelSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rows = await db
    .select()
    .from(bookingsWhitelabel)
    .where(eq(bookingsWhitelabel.id, id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = rows[0];

  if (!CANCELLABLE_STATUSES.has(booking.status)) {
    return NextResponse.json(
      { error: `Cannot cancel a booking with status "${booking.status}"` },
      { status: 409 }
    );
  }

  await db
    .update(bookingsWhitelabel)
    .set({ status: "cancelled" })
    .where(eq(bookingsWhitelabel.id, id));

  return NextResponse.json({ ok: true });
}
