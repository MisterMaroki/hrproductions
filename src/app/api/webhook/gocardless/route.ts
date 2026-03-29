import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings, clients } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/gocardless";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const HARRISON_EMAIL = "harrison@thepropertyroom.co";

interface GoCardlessEvent {
  id: string;
  resource_type: string;
  action: string;
  links: Record<string, string>;
  details: {
    cause: string;
    description: string;
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("webhook-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(body);
  const events: GoCardlessEvent[] = payload.events || [];

  for (const event of events) {
    try {
      if (event.resource_type === "payments") {
        await handlePaymentEvent(event);
      } else if (event.resource_type === "mandates") {
        await handleMandateEvent(event);
      }
    } catch (err) {
      console.error(`Error processing GoCardless event ${event.id}:`, err);
    }
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentEvent(event: GoCardlessEvent) {
  const paymentId = event.links.payment;

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.gocardlessPaymentId, paymentId))
    .limit(1);

  if (invoiceRows.length === 0) return;

  const invoice = invoiceRows[0];

  if (event.action === "paid_out") {
    const now = new Date().toISOString();

    await db
      .update(invoices)
      .set({ status: "paid", paidAt: now })
      .where(eq(invoices.id, invoice.id));

    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    const bookingIds = items.map((i) => i.bookingId);
    if (bookingIds.length > 0) {
      await db
        .update(bookings)
        .set({ status: "paid" })
        .where(inArray(bookings.id, bookingIds));
    }

    await db
      .update(clients)
      .set({ bookingsPaused: 0 })
      .where(eq(clients.id, invoice.clientId));

    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: `Payment of £${(invoice.totalAmount / 100).toFixed(2)} Received — The Property Room`,
        html: `
          <h2>Payment Received</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your payment of <strong>£${(invoice.totalAmount / 100).toFixed(2)}</strong> has been received. Thank you.</p>
        `,
      }).catch((err) => console.error("Failed to send payment confirmation:", err));
    }
  } else if (event.action === "failed") {
    const reason = event.details?.description || event.details?.cause || "Unknown reason";

    await db
      .update(invoices)
      .set({ status: "failed", failureReason: reason })
      .where(eq(invoices.id, invoice.id));

    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    const bookingIds = items.map((i) => i.bookingId);
    if (bookingIds.length > 0) {
      await db
        .update(bookings)
        .set({ status: "payment_failed" })
        .where(inArray(bookings.id, bookingIds));
    }

    await db
      .update(clients)
      .set({ bookingsPaused: 1 })
      .where(eq(clients.id, invoice.clientId));

    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];

      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Payment Failed — The Property Room",
        html: `
          <h2>Payment Failed</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your payment of <strong>£${(invoice.totalAmount / 100).toFixed(2)}</strong> has failed.</p>
          <p>Your ability to book new shoots has been paused until this is resolved. Please contact us.</p>
        `,
      }).catch((err) => console.error("Failed to send client failure email:", err));

      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: HARRISON_EMAIL,
        subject: `Payment Failed: ${client.companyName} — £${(invoice.totalAmount / 100).toFixed(2)}`,
        html: `
          <h2>Payment Failed</h2>
          <p><strong>Client:</strong> ${client.companyName} (${client.contactName})</p>
          <p><strong>Amount:</strong> £${(invoice.totalAmount / 100).toFixed(2)}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Client bookings have been automatically paused.</p>
        `,
      }).catch((err) => console.error("Failed to send admin failure email:", err));
    }
  }
}

async function handleMandateEvent(event: GoCardlessEvent) {
  const mandateId = event.links.mandate;

  if (event.action === "active") {
    const customerId = event.links.customer;

    await db
      .update(clients)
      .set({
        gocardlessMandateId: mandateId,
        gocardlessCustomerId: customerId || null,
      })
      .where(eq(clients.gocardlessCustomerId, customerId));
  } else if (event.action === "cancelled" || event.action === "failed") {
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.gocardlessMandateId, mandateId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];

      await db
        .update(clients)
        .set({ gocardlessMandateId: null, bookingsPaused: 1 })
        .where(eq(clients.id, client.id));

      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Payment Method No Longer Valid — The Property Room",
        html: `
          <h2>Payment Method Invalid</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your Direct Debit mandate is no longer valid. Please log in to set up a new payment method.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/account/setup-mandate">Set up payment</a></p>
        `,
      }).catch((err) => console.error("Failed to send mandate email:", err));

      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: HARRISON_EMAIL,
        subject: `Mandate Cancelled: ${client.companyName}`,
        html: `
          <h2>Mandate Cancelled</h2>
          <p><strong>Client:</strong> ${client.companyName} (${client.contactName})</p>
          <p>Their Direct Debit mandate has been ${event.action}. Bookings have been paused.</p>
        `,
      }).catch((err) => console.error("Failed to send mandate admin email:", err));
    }
  }
}
