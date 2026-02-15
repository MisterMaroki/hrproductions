import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discountCodes } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const codes = await db
    .select()
    .from(discountCodes)
    .orderBy(discountCodes.createdAt);
  return NextResponse.json(codes);
}

export async function POST(request: Request) {
  try {
    const { code, percentage, maxUses, expiresAt } = await request.json();

    if (!code || !percentage) {
      return NextResponse.json(
        { error: "Code and percentage are required" },
        { status: 400 }
      );
    }

    if (percentage < 1 || percentage > 100) {
      return NextResponse.json(
        { error: "Percentage must be between 1 and 100" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(discountCodes).values({
      id,
      code: code.toUpperCase().trim(),
      percentage,
      maxUses: maxUses || null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ id, code: code.toUpperCase().trim() }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A code with that name already exists" },
        { status: 409 }
      );
    }
    console.error("Create discount error:", err);
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    if (updates.code !== undefined) allowed.code = updates.code.toUpperCase().trim();
    if (updates.percentage !== undefined) allowed.percentage = updates.percentage;
    if (updates.active !== undefined) allowed.active = updates.active;
    if (updates.maxUses !== undefined) allowed.maxUses = updates.maxUses;
    if (updates.expiresAt !== undefined) allowed.expiresAt = updates.expiresAt;

    await db.update(discountCodes).set(allowed).where(eq(discountCodes.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update code" }, { status: 500 });
  }
}
