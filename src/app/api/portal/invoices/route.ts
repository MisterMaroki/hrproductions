import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
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
