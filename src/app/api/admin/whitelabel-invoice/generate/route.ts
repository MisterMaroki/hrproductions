import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { isNull, eq, desc } from "drizzle-orm";
import { generateWhitelabelInvoicePdf, readBillToFromEnv } from "@/lib/whitelabel-invoice-pdf";

function nextInvoiceNumber(existing: string | undefined): string {
  if (!existing) return "WL-0001";
  const m = existing.match(/WL-(\d+)/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `WL-${String(n).padStart(4, "0")}`;
}

export async function POST() {
  const pending = await db
    .select()
    .from(bookingsWhitelabel)
    .where(isNull(bookingsWhitelabel.whitelabelInvoiceId));

  if (pending.length === 0) {
    return NextResponse.json({ error: "No un-invoiced bookings" }, { status: 400 });
  }

  const latest = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt))
    .limit(1);
  const invoiceNumber = nextInvoiceNumber(latest[0]?.invoiceNumber);

  const totalAmount = pending.reduce((sum, b) => sum + b.total, 0);
  const invoiceId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  await db.insert(whitelabelInvoices).values({
    id: invoiceId,
    invoiceNumber,
    totalAmount,
    bookingCount: pending.length,
    generatedAt,
  });

  for (const b of pending) {
    await db
      .update(bookingsWhitelabel)
      .set({ whitelabelInvoiceId: invoiceId })
      .where(eq(bookingsWhitelabel.id, b.id));
  }

  const pdf = await generateWhitelabelInvoicePdf({
    invoiceNumber,
    generatedAt,
    billTo: readBillToFromEnv(),
    bookings: pending.map((b) => ({
      address: b.address,
      postcode: b.postcode,
      bedrooms: b.bedrooms,
      preferredDate: b.preferredDate,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.services,
      total: b.total,
    })),
    totalAmount,
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
    },
  });
}
