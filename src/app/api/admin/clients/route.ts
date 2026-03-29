import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings } from "@/lib/schema";
import { eq, like, or, sql, and } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions = [];
  if (status) conditions.push(eq(clients.status, status));
  if (search) {
    conditions.push(
      or(
        like(clients.companyName, `%${search}%`),
        like(clients.email, `%${search}%`),
        like(clients.contactName, `%${search}%`)
      )!
    );
  }

  const clientRows = await db
    .select()
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(clients.createdAt);

  const result = await Promise.all(
    clientRows.map(async (c) => {
      const balance = await db
        .select({
          total: sql<number>`coalesce(sum(${bookings.total}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(and(eq(bookings.clientId, c.id), eq(bookings.status, "completed")));

      return {
        ...c,
        runningBalance: balance[0]?.total ?? 0,
        completedBookings: balance[0]?.count ?? 0,
      };
    })
  );

  return NextResponse.json(result);
}
