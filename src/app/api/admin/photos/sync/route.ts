import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryPhotos } from "@/lib/schema";
import { inArray } from "drizzle-orm";
import { fetchBunnyStorageFiles } from "@/lib/bunny";

export async function GET() {
  const apiKey = process.env.BUNNY_STORAGE_API_KEY;
  const zoneName = process.env.BUNNY_STORAGE_ZONE_NAME;

  if (!apiKey || !zoneName) {
    return NextResponse.json(
      { error: "Bunny Storage credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const files = await fetchBunnyStorageFiles(apiKey, zoneName, "images/");
    const imageExtensions = [".webp", ".jpg", ".jpeg", ".png", ".avif"];
    const imageFiles = files.filter((f) =>
      imageExtensions.some((ext) => f.ObjectName.toLowerCase().endsWith(ext))
    );
    const remoteFilenames = imageFiles.map((f) => f.ObjectName);

    const localPhotos = await db.select().from(galleryPhotos);
    const localByFilename = new Map(
      localPhotos.map((p) => [p.filename, p])
    );

    const maxOrder = localPhotos.reduce(
      (max, p) => Math.max(max, p.sortOrder),
      0
    );
    let nextOrder = maxOrder + 1;

    for (const file of imageFiles) {
      if (!localByFilename.has(file.ObjectName)) {
        const name = file.ObjectName.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
        await db.insert(galleryPhotos).values({
          id: crypto.randomUUID(),
          filename: file.ObjectName,
          title: name,
          sortOrder: nextOrder++,
          visible: 0,
        });
      }
    }

    const localFilenames = localPhotos.map((p) => p.filename);
    const deletedFilenames = localFilenames.filter(
      (f) => !remoteFilenames.includes(f)
    );
    if (deletedFilenames.length > 0) {
      await db
        .delete(galleryPhotos)
        .where(inArray(galleryPhotos.filename, deletedFilenames));
    }

    const updated = await db
      .select()
      .from(galleryPhotos)
      .orderBy(galleryPhotos.sortOrder);

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Photo sync error:", err);
    return NextResponse.json(
      { error: "Failed to sync photos from Bunny Storage" },
      { status: 500 }
    );
  }
}
