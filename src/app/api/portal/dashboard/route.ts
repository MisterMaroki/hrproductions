import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices, bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq, and, ne, sql, isNull, desc } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

export async function GET() {
  if (isWhiteLabel()) {
    return handleWhitelabelDashboard();
  }
  return handleMainDashboard();
}

async function handleWhitelabelDashboard() {
  const session = await getWhitelabelSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookingsWhitelabel)
    .where(
      and(
        sql`${bookingsWhitelabel.preferredDate} >= ${today}`,
        eq(bookingsWhitelabel.status, "confirmed"),
      )
    );

  const uninvoiced = await db
    .select({ total: sql<number>`coalesce(sum(${bookingsWhitelabel.total}), 0)` })
    .from(bookingsWhitelabel)
    .where(
      and(
        isNull(bookingsWhitelabel.whitelabelInvoiceId),
        ne(bookingsWhitelabel.status, "cancelled"),
      )
    );

  const latest = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt))
    .limit(1);

  return NextResponse.json({
    brand: "whitelabel",
    companyName: process.env.WHITELABEL_INVOICE_COMPANY || "",
    upcomingCount: upcoming[0]?.count ?? 0,
    uninvoicedTotal: uninvoiced[0]?.total ?? 0,
    lastInvoiceAt: latest[0]?.generatedAt ?? null,
    lastInvoiceNumber: latest[0]?.invoiceNumber ?? null,
  });
}

async function handleMainDashboard() {
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
    brand: "main",
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
