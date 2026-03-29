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
    .select({ gocardlessMandateId: clients.gocardlessMandateId })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ hasMandateSetup: !!rows[0].gocardlessMandateId });
}
