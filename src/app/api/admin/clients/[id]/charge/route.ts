import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices, invoiceItems } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createPayment } from "@/lib/gocardless";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { bookingIds } = await request.json();

  if (!bookingIds?.length) {
    return NextResponse.json({ error: "No bookings selected" }, { status: 400 });
  }

  const clientRows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  if (!client.gocardlessMandateId) {
    return NextResponse.json({ error: "Client has no active payment mandate" }, { status: 400 });
  }

  const selectedBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.clientId, id),
        eq(bookings.status, "completed"),
        inArray(bookings.id, bookingIds)
      )
    );

  if (selectedBookings.length === 0) {
    return NextResponse.json({ error: "No valid completed bookings found" }, { status: 400 });
  }

  const totalAmount = selectedBookings.reduce((s, b) => s + b.total, 0);
  const invoiceId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.insert(invoices).values({
      id: invoiceId,
      clientId: id,
      totalAmount,
      status: "pending",
      chargedAt: now,
    });

    for (const b of selectedBookings) {
      await db.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId,
        bookingId: b.id,
        amount: b.total,
      });
    }

    // Generate PDF — use the account invoice PDF generator if available, otherwise skip for now
    let pdfBuffer: Buffer | null = null;
    try {
      const { generateAccountInvoicePdf } = await import("@/lib/account-invoice-pdf");
      pdfBuffer = await generateAccountInvoicePdf({
        invoiceId,
        client,
        bookings: selectedBookings,
        totalAmount,
        chargedAt: now,
      });

      const { writeFile, mkdir } = await import("fs/promises");
      const { join } = await import("path");
      const pdfDir = join(process.cwd(), "invoices");
      await mkdir(pdfDir, { recursive: true });
      const pdfPath = join(pdfDir, `${invoiceId}.pdf`);
      await writeFile(pdfPath, pdfBuffer);

      await db.update(invoices).set({ pdfPath }).where(eq(invoices.id, invoiceId));
    } catch (pdfErr) {
      console.error("Failed to generate invoice PDF:", pdfErr);
    }

    const paymentId = await createPayment(
      client.gocardlessMandateId,
      totalAmount,
      `The Property Room — ${selectedBookings.length} shoot${selectedBookings.length !== 1 ? "s" : ""}`,
      invoiceId
    );

    await db.update(invoices).set({ gocardlessPaymentId: paymentId }).where(eq(invoices.id, invoiceId));

    await db.update(bookings).set({ status: "invoiced" }).where(inArray(bookings.id, bookingIds));

    resend.emails.send({
      from: "Harrison <harrison@thepropertyroom.co>",
      to: client.email,
      subject: `Invoice for £${(totalAmount / 100).toFixed(2)} — The Property Room`,
      html: `
        <h2>Invoice</h2>
        <p>Hi ${client.contactName},</p>
        <p>An invoice for <strong>£${(totalAmount / 100).toFixed(2)}</strong> has been raised for ${selectedBookings.length} shoot${selectedBookings.length !== 1 ? "s" : ""}.</p>
        <p>Payment will be collected via Direct Debit within a few working days.</p>
        <p>Your invoice is attached as a PDF.</p>
      `,
      ...(pdfBuffer ? {
        attachments: [{
          filename: `invoice-${invoiceId.slice(0, 8)}.pdf`,
          content: pdfBuffer,
        }],
      } : {}),
    }).catch((err) => console.error("Failed to send invoice email:", err));

    return NextResponse.json({
      success: true,
      invoiceId,
      totalAmount,
      bookingsCharged: selectedBookings.length,
    });
  } catch (err) {
    console.error("Charge error:", err);
    return NextResponse.json({ error: "Failed to process charge" }, { status: 500 });
  }
}
