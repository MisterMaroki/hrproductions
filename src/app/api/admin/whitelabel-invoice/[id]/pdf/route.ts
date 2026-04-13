import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generateWhitelabelInvoicePdf, readBillToFromEnv } from "@/lib/whitelabel-invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = (await db.select().from(whitelabelInvoices).where(eq(whitelabelInvoices.id, id)))[0];
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select()
    .from(bookingsWhitelabel)
    .where(eq(bookingsWhitelabel.whitelabelInvoiceId, id));

  const pdf = await generateWhitelabelInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    generatedAt: invoice.generatedAt ?? new Date().toISOString(),
    billTo: readBillToFromEnv(),
    bookings: items.map((b) => ({
      address: b.address,
      postcode: b.postcode,
      bedrooms: b.bedrooms,
      preferredDate: b.preferredDate,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.services,
      total: b.total,
    })),
    totalAmount: invoice.totalAmount,
  });

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
