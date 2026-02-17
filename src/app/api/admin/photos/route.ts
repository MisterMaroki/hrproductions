import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.visible !== undefined) allowed.visible = updates.visible;
    if (updates.sortOrder !== undefined) allowed.sortOrder = updates.sortOrder;

    await db.update(galleryPhotos).set(allowed).where(eq(galleryPhotos.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update photo" },
      { status: 500 }
    );
  }
}
