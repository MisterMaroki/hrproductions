import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, clients } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [];

  if (from) conditions.push(gte(bookings.preferredDate, from));
  if (to) conditions.push(lte(bookings.preferredDate, to));

  const rows = await db
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

    const validStatuses = ["confirmed", "completed", "cancelled", "invoiced", "paid", "payment_failed"];
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
