import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, bookingsWhitelabel, clients } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const mainConds = [];
  if (from) mainConds.push(gte(bookings.preferredDate, from));
  if (to) mainConds.push(lte(bookings.preferredDate, to));

  const wlConds = [];
  if (from) wlConds.push(gte(bookingsWhitelabel.preferredDate, from));
  if (to) wlConds.push(lte(bookingsWhitelabel.preferredDate, to));

  const [mainRows, wlRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        address: bookings.address,
        postcode: bookings.postcode,
        bedrooms: bookings.bedrooms,
        preferredDate: bookings.preferredDate,
        startTime: bookings.startTime,
        endTime: bookings.endTime,
        notes: bookings.notes,
        agentName: bookings.agentName,
        agentCompany: bookings.agentCompany,
        agentEmail: bookings.agentEmail,
        agentPhone: bookings.agentPhone,
        services: bookings.services,
        workHours: bookings.workHours,
        subtotal: bookings.subtotal,
        discountCode: bookings.discountCode,
        discountAmount: bookings.discountAmount,
        total: bookings.total,
        stripeSession: bookings.stripeSession,
        status: bookings.status,
        createdAt: bookings.createdAt,
        clientId: bookings.clientId,
        clientCompanyName: clients.companyName,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .where(mainConds.length ? and(...mainConds) : undefined),

    db
      .select()
      .from(bookingsWhitelabel)
      .where(wlConds.length ? and(...wlConds) : undefined),
  ]);

  const merged = [
    ...mainRows.map((r) => ({ ...r, source: "main" as const })),
    ...wlRows.map((r) => ({
      ...r,
      stripeSession: null,
      clientId: null,
      clientCompanyName: null,
      source: "whitelabel" as const,
    })),
  ];

  merged.sort((a, b) => {
    if (a.preferredDate !== b.preferredDate)
      return a.preferredDate.localeCompare(b.preferredDate);
    return (a.startTime ?? "").localeCompare(b.startTime ?? "");
  });

  return NextResponse.json(merged);
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

    const validStatuses = ["confirmed", "completed", "cancelled", "invoiced", "paid", "payment_failed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const main = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.id, id))
      .limit(1);

    if (main.length) {
      await db.update(bookings).set({ status }).where(eq(bookings.id, id));
      return NextResponse.json({ success: true, source: "main" });
    }

    const wl = await db
      .select({ id: bookingsWhitelabel.id })
      .from(bookingsWhitelabel)
      .where(eq(bookingsWhitelabel.id, id))
      .limit(1);

    if (wl.length) {
      await db
        .update(bookingsWhitelabel)
        .set({ status })
        .where(eq(bookingsWhitelabel.id, id));
      return NextResponse.json({ success: true, source: "whitelabel" });
    }

    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}
