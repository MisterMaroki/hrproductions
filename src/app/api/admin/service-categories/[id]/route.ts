import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceCategories, services } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, sortOrder } = await request.json();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await db
      .update(serviceCategories)
      .set(updates)
      .where(eq(serviceCategories.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update service category error:", err);
    return NextResponse.json(
      { error: "Failed to update category" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Prevent deletion if category has services
    const existingServices = await db
      .select()
      .from(services)
      .where(eq(services.categoryId, id))
      .limit(1);

    if (existingServices.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete category that has services" },
        { status: 400 }
      );
    }

    await db.delete(serviceCategories).where(eq(serviceCategories.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete service category error:", err);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}
