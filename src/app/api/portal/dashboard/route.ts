import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = session.sub;

  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  const completedBookings = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${bookings.total}), 0)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "completed"))
    );

  const pendingBookings = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "pending"))
    );

  const paidInvoices = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.clientId, clientId), eq(invoices.status, "paid"))
    );

  return NextResponse.json({
    client: {
      id: client.id,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      status: client.status,
      hasMandateSetup: !!client.gocardlessMandateId,
      bookingsPaused: !!client.bookingsPaused,
    },
    runningTotal: completedBookings[0]?.total ?? 0,
    completedShootCount: completedBookings[0]?.count ?? 0,
    pendingShootCount: pendingBookings[0]?.count ?? 0,
    totalPaidToDate: paidInvoices[0]?.total ?? 0,
  });
}
