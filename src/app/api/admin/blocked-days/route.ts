import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blockedDays } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const days = await db
    .select()
    .from(blockedDays)
    .orderBy(blockedDays.date);
  return NextResponse.json(days);
}

export async function POST(request: Request) {
  try {
    const { date, reason } = await request.json();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Valid date (YYYY-MM-DD) is required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(blockedDays).values({
      id,
      date,
      reason: reason || null,
    });

    return NextResponse.json({ id, date }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "This date is already blocked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to block day" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await db.delete(blockedDays).where(eq(blockedDays.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unblock day" }, { status: 500 });
  }
}
