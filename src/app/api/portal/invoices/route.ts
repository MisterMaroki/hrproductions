import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings, bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq, isNull, desc, sql } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

export async function GET() {
  if (isWhiteLabel()) {
    const session = await getWhitelabelSession();
    if (!session?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [uninvoiced, past] = await Promise.all([
      db
        .select({ total: sql<number>`coalesce(sum(${bookingsWhitelabel.total}), 0)` })
        .from(bookingsWhitelabel)
        .where(isNull(bookingsWhitelabel.whitelabelInvoiceId)),
      db
        .select()
        .from(whitelabelInvoices)
        .orderBy(desc(whitelabelInvoices.generatedAt)),
    ]);

    return NextResponse.json({
      brand: "whitelabel",
      uninvoicedTotal: uninvoiced[0]?.total ?? 0,
      invoices: past,
    });
  }

  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, session.sub))
    .orderBy(invoices.createdAt);

  const result = await Promise.all(
    invoiceRows.map(async (inv) => {
      const items = await db
        .select({
          id: invoiceItems.id,
          bookingId: invoiceItems.bookingId,
          amount: invoiceItems.amount,
          address: bookings.address,
          postcode: bookings.postcode,
          preferredDate: bookings.preferredDate,
          services: bookings.services,
        })
        .from(invoiceItems)
        .leftJoin(bookings, eq(invoiceItems.bookingId, bookings.id))
        .where(eq(invoiceItems.invoiceId, inv.id));

      return { ...inv, items };
    })
  );

  return NextResponse.json(result);
}
