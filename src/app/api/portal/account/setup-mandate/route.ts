import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { createBillingRequestFlow } from "@/lib/gocardless";

export async function POST() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(clients).where(eq(clients.id, session.sub)).limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = rows[0];

  if (client.status !== "active") {
    return NextResponse.json(
      { error: "Account must be active to set up payment" },
      { status: 403 }
    );
  }

  try {
    const { authorisationUrl } = await createBillingRequestFlow(
      client.email,
      client.contactName,
      client.companyName
    );

    return NextResponse.json({ authorisationUrl });
  } catch (err) {
    console.error("GoCardless mandate setup error:", err);
    return NextResponse.json(
      { error: "Failed to set up payment method" },
      { status: 500 }
    );
  }
}
