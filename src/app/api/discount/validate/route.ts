import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discountCodes } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const [discount] = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.code, code.toUpperCase().trim()),
          eq(discountCodes.active, 1)
        )
      )
      .limit(1);

    if (!discount) {
      return NextResponse.json({ error: "Invalid discount code" }, { status: 404 });
    }

    if (discount.maxUses && discount.timesUsed! >= discount.maxUses) {
      return NextResponse.json(
        { error: "This code has reached its usage limit" },
        { status: 410 }
      );
    }

    if (discount.expiresAt) {
      const today = new Date().toISOString().split("T")[0];
      if (discount.expiresAt < today) {
        return NextResponse.json(
          { error: "This code has expired" },
          { status: 410 }
        );
      }
    }

    return NextResponse.json({
      code: discount.code,
      percentage: discount.percentage,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to validate code" },
      { status: 500 }
    );
  }
}
