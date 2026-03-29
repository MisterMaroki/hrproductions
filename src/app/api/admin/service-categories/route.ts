import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceCategories, services } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const categories = await db
    .select()
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder));
  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  try {
    const { name, sortOrder } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(serviceCategories).values({
      id,
      name,
      sortOrder: sortOrder ?? 0,
    });

    return NextResponse.json({ id, name }, { status: 201 });
  } catch (err) {
    console.error("Create service category error:", err);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 }
    );
  }
}
