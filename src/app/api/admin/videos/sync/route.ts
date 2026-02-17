import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryVideos } from "@/lib/schema";
import { inArray } from "drizzle-orm";
import { fetchBunnyVideos } from "@/lib/bunny";

export async function GET() {
  const apiKey = process.env.BUNNY_STREAM_API_KEY;
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;

  if (!apiKey || !libraryId) {
    return NextResponse.json(
      { error: "Bunny Stream credentials not configured" },
      { status: 500 }
    );
  }

  try {
    // Fetch all videos from Bunny Stream
    const bunnyVideos = await fetchBunnyVideos(apiKey, libraryId);
    const bunnyIds = bunnyVideos.map((v) => v.guid);

    // Get existing local records
    const localVideos = await db.select().from(galleryVideos);
    const localByBunnyId = new Map(
      localVideos.map((v) => [v.bunnyVideoId, v])
    );

    // Insert new videos from Bunny (not yet in local DB)
    const maxOrder = localVideos.reduce(
      (max, v) => Math.max(max, v.sortOrder),
      0
    );
    let nextOrder = maxOrder + 1;

    for (const bv of bunnyVideos) {
      if (!localByBunnyId.has(bv.guid)) {
        await db.insert(galleryVideos).values({
          id: crypto.randomUUID(),
          bunnyVideoId: bv.guid,
          title: bv.title || "Untitled",
          sortOrder: nextOrder++,
          visible: 0,
        });
      }
    }

    // Remove local records for videos deleted from Bunny
    const localBunnyIds = localVideos.map((v) => v.bunnyVideoId);
    const deletedIds = localBunnyIds.filter((id) => !bunnyIds.includes(id));
    if (deletedIds.length > 0) {
      await db
        .delete(galleryVideos)
        .where(inArray(galleryVideos.bunnyVideoId, deletedIds));
    }

    // Return updated list
    const updated = await db
      .select()
      .from(galleryVideos)
      .orderBy(galleryVideos.sortOrder);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Bunny sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync with Bunny Stream" },
      { status: 500 }
    );
  }
}
