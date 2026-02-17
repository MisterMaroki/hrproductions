import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { buildCdnUrl } from "@/lib/bunny";

export async function GET() {
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME;

  if (!cdnHostname) {
    return NextResponse.json([]);
  }

  const photos = await db
    .select()
    .from(galleryPhotos)
    .where(eq(galleryPhotos.visible, 1))
    .orderBy(galleryPhotos.sortOrder);

  const result = photos.map((p) => ({
    id: p.id,
    title: p.title,
    src: buildCdnUrl(cdnHostname, `images/${p.filename}`),
  }));

  return NextResponse.json(result);
}
