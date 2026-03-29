import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      contactName: clients.contactName,
      email: clients.email,
      phone: clients.phone,
      status: clients.status,
      gocardlessMandateId: clients.gocardlessMandateId,
      bookingsPaused: clients.bookingsPaused,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function PATCH(request: Request) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyName, contactName, phone } = await request.json();

  const updates: Record<string, string> = {};
  if (companyName) updates.companyName = companyName;
  if (contactName) updates.contactName = contactName;
  if (phone) updates.phone = phone;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(clients).set(updates).where(eq(clients.id, session.sub));

  return NextResponse.json({ success: true });
}
