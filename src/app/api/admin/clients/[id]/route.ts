import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = rows[0];

  const completedBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.clientId, id), eq(bookings.status, "completed")));

  const runningBalance = completedBookings.reduce((s, b) => s + b.total, 0);

  const allBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.clientId, id))
    .orderBy(bookings.preferredDate);

  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .orderBy(invoices.createdAt);

  return NextResponse.json({
    client,
    completedBookings,
    runningBalance,
    allBookings,
    invoices: clientInvoices,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = rows[0];
  const updates: Record<string, unknown> = {};

  if (body.status) {
    const validStatuses = ["pending_approval", "active", "suspended", "deactivated"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;

    if (body.status === "active" && client.status === "pending_approval") {
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Your Account Has Been Approved — The Property Room",
        html: `
          <h2>Account Approved</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your account for <strong>${client.companyName}</strong> has been approved.</p>
          <p>Log in to set up your payment method and start booking shoots.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/login">Log in to your portal</a></p>
        `,
      }).catch((err) => console.error("Failed to send approval email:", err));
    }

    if (body.status === "suspended" || body.status === "deactivated") {
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: `Your Account Has Been ${body.status === "suspended" ? "Suspended" : "Deactivated"} — The Property Room`,
        html: `
          <h2>Account ${body.status === "suspended" ? "Suspended" : "Deactivated"}</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your account for <strong>${client.companyName}</strong> has been ${body.status}.</p>
          <p>Please contact us if you have any questions.</p>
        `,
      }).catch((err) => console.error("Failed to send status email:", err));
    }
  }

  if (body.unpauseBookings === true) {
    updates.bookingsPaused = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(clients).set(updates).where(eq(clients.id, id));

  return NextResponse.json({ success: true });
}
