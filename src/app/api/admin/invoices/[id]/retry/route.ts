import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings, clients } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { createPayment, getMandate } from "@/lib/gocardless";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoiceRows = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (invoiceRows.length === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = invoiceRows[0];

  if (invoice.status !== "failed") {
    return NextResponse.json({ error: "Can only retry failed invoices" }, { status: 400 });
  }

  const clientRows = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1);
  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  if (!client.gocardlessMandateId) {
    return NextResponse.json(
      { error: "Client has no active mandate. They need to set up a new payment method." },
      { status: 400 }
    );
  }

  try {
    const mandate = await getMandate(client.gocardlessMandateId);
    if (mandate.status !== "active") {
      return NextResponse.json(
        { error: "Client's mandate is no longer active. They need to set up a new payment method." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Could not verify mandate status" }, { status: 500 });
  }

  try {
    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id));

    const bookingIds = items.map((i) => i.bookingId);

    const paymentId = await createPayment(
      client.gocardlessMandateId,
      invoice.totalAmount,
      `The Property Room — retry`,
      invoice.id
    );

    await db
      .update(invoices)
      .set({ status: "pending", gocardlessPaymentId: paymentId, failureReason: null })
      .where(eq(invoices.id, id));

    if (bookingIds.length > 0) {
      await db.update(bookings).set({ status: "invoiced" }).where(inArray(bookings.id, bookingIds));
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err) {
    console.error("Retry payment error:", err);
    return NextResponse.json({ error: "Failed to retry payment" }, { status: 500 });
  }
}
