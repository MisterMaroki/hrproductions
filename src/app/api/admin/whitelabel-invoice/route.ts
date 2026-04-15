import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { and, desc, isNull, inArray } from "drizzle-orm";

export async function GET() {
  const pending = await db
    .select()
    .from(bookingsWhitelabel)
    .where(
      and(
        isNull(bookingsWhitelabel.whitelabelInvoiceId),
        inArray(bookingsWhitelabel.status, ["pending", "confirmed", "completed"]),
      )
    )
    .orderBy(desc(bookingsWhitelabel.preferredDate));

  const past = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt));

  return NextResponse.json({ pending, past });
}
