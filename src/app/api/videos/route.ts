import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryVideos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { buildThumbnailUrl, buildPlayUrl } from "@/lib/bunny";

export async function GET() {
  const pullZone = process.env.BUNNY_STREAM_PULL_ZONE;

  if (!pullZone) {
    return NextResponse.json([]);
  }

  const videos = await db
    .select()
    .from(galleryVideos)
    .where(eq(galleryVideos.visible, 1))
    .orderBy(galleryVideos.sortOrder);

  const result = videos.map((v) => ({
    id: v.id,
    title: v.title,
    thumbnail: buildThumbnailUrl(pullZone, v.bunnyVideoId),
    src: buildPlayUrl(pullZone, v.bunnyVideoId),
  }));

  return NextResponse.json(result);
}
