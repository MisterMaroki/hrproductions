# Bunny.net Video Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate bunny.net Stream + CDN for all video content, with admin panel management synced from Bunny's API.

**Architecture:** New `gallery_videos` DB table stores Bunny video GUIDs with local metadata (title, visibility, order). Admin page syncs from Bunny Stream API on load. Gallery fetches visible videos from a public API route. Hero video served via Bunny CDN URL.

**Tech Stack:** Next.js 16, Drizzle ORM, Turso (SQLite), Bunny Stream API, CSS Modules

---

### Task 1: Add gallery_videos table to schema

**Files:**
- Modify: `src/lib/schema.ts`

**Step 1: Add the table definition**

Add to the bottom of `src/lib/schema.ts`:

```ts
export const galleryVideos = sqliteTable("gallery_videos", {
  id: text("id").primaryKey(),
  bunnyVideoId: text("bunny_video_id").notNull().unique(),
  title: text("title").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 2: Push the schema to Turso**

Run: `npx drizzle-kit push`
Expected: Table `gallery_videos` created successfully

**Step 3: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat: add gallery_videos table for bunny.net integration"
```

---

### Task 2: Create Bunny Stream helper library

**Files:**
- Create: `src/lib/bunny.ts`
- Create: `src/lib/__tests__/bunny.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/__tests__/bunny.test.ts`:

```ts
import { buildThumbnailUrl, buildPlayUrl } from "../bunny";

describe("bunny URL builders", () => {
  const pullZone = "vz-abc123.b-cdn.net";
  const videoId = "test-video-guid-123";

  it("builds thumbnail URL", () => {
    expect(buildThumbnailUrl(pullZone, videoId)).toBe(
      "https://vz-abc123.b-cdn.net/test-video-guid-123/thumbnail.jpg"
    );
  });

  it("builds play URL", () => {
    expect(buildPlayUrl(pullZone, videoId)).toBe(
      "https://vz-abc123.b-cdn.net/test-video-guid-123/play_720p.mp4"
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/__tests__/bunny.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the helper**

Create `src/lib/bunny.ts`:

```ts
export function buildThumbnailUrl(pullZone: string, videoId: string): string {
  return `https://${pullZone}/${videoId}/thumbnail.jpg`;
}

export function buildPlayUrl(pullZone: string, videoId: string): string {
  return `https://${pullZone}/${videoId}/play_720p.mp4`;
}

export interface BunnyApiVideo {
  guid: string;
  title: string;
  status: number; // 4 = finished encoding
}

export async function fetchBunnyVideos(
  apiKey: string,
  libraryId: string
): Promise<BunnyApiVideo[]> {
  const items: BunnyApiVideo[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos?page=${page}&itemsPerPage=${perPage}`,
      { headers: { AccessKey: apiKey } }
    );

    if (!res.ok) {
      throw new Error(`Bunny API error: ${res.status}`);
    }

    const data = await res.json();
    const videos: BunnyApiVideo[] = data.items ?? [];
    items.push(...videos);

    if (videos.length < perPage) break;
    page++;
  }

  return items;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/bunny.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/bunny.ts src/lib/__tests__/bunny.test.ts
git commit -m "feat: add bunny.net helper library with URL builders"
```

---

### Task 3: Create sync API route

**Files:**
- Create: `src/app/api/admin/videos/sync/route.ts`

**Step 1: Implement the sync route**

Create `src/app/api/admin/videos/sync/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryVideos } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
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
```

**Step 2: Commit**

```bash
git add src/app/api/admin/videos/sync/route.ts
git commit -m "feat: add bunny video sync API route"
```

---

### Task 4: Create PATCH API route for admin updates

**Files:**
- Create: `src/app/api/admin/videos/route.ts`

**Step 1: Implement the PATCH route**

Create `src/app/api/admin/videos/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { galleryVideos } from "@/lib/schema";
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

    await db.update(galleryVideos).set(allowed).where(eq(galleryVideos.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update video" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/admin/videos/route.ts
git commit -m "feat: add admin PATCH route for video management"
```

---

### Task 5: Create public videos API route

**Files:**
- Create: `src/app/api/videos/route.ts`

**Step 1: Implement the public route**

Create `src/app/api/videos/route.ts`:

```ts
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
```

**Step 2: Commit**

```bash
git add src/app/api/videos/route.ts
git commit -m "feat: add public videos API route"
```

---

### Task 6: Update AdminNav with Videos link

**Files:**
- Modify: `src/app/admin/components/AdminNav.tsx`

**Step 1: Add the Videos link**

In `src/app/admin/components/AdminNav.tsx`, add a new `<Link>` for Videos between Calendar and Discounts (after line 27, before line 28):

```tsx
<Link
  href="/admin/videos"
  className={`${styles.link} ${pathname === '/admin/videos' ? styles.active : ''}`}
>
  Videos
</Link>
```

**Step 2: Verify the dev server renders the nav correctly**

Run: `npm run dev`
Navigate to `/admin` and verify the Videos link appears.

**Step 3: Commit**

```bash
git add src/app/admin/components/AdminNav.tsx
git commit -m "feat: add Videos link to admin navigation"
```

---

### Task 7: Create admin videos page

**Files:**
- Create: `src/app/admin/videos/page.tsx`
- Create: `src/app/admin/videos/page.module.css`

**Step 1: Create the page component**

Create `src/app/admin/videos/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface GalleryVideo {
  id: string;
  bunnyVideoId: string;
  title: string;
  sortOrder: number;
  visible: number;
  createdAt: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const syncVideos = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/videos/sync");
      if (res.ok) setVideos(await res.json());
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    syncVideos();
  }, [syncVideos]);

  const toggleVisible = async (id: string, currentVisible: number) => {
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, visible: currentVisible ? 0 : 1 }),
    });
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, visible: currentVisible ? 0 : 1 } : v
      )
    );
  };

  const moveVideo = async (id: string, direction: "up" | "down") => {
    const idx = videos.findIndex((v) => v.id === id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= videos.length) return;

    const current = videos[idx];
    const swap = videos[swapIdx];

    await Promise.all([
      fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, sortOrder: swap.sortOrder }),
      }),
      fetch("/api/admin/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: swap.id, sortOrder: current.sortOrder }),
      }),
    ]);

    setVideos((prev) => {
      const next = [...prev];
      next[idx] = { ...current, sortOrder: swap.sortOrder };
      next[swapIdx] = { ...swap, sortOrder: current.sortOrder };
      next.sort((a, b) => a.sortOrder - b.sortOrder);
      return next;
    });
  };

  const startEdit = (video: GalleryVideo) => {
    setEditingId(video.id);
    setEditTitle(video.title);
  };

  const saveTitle = async (id: string) => {
    if (!editTitle.trim()) return;
    await fetch("/api/admin/videos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editTitle.trim() }),
    });
    setVideos((prev) =>
      prev.map((v) => (v.id === id ? { ...v, title: editTitle.trim() } : v))
    );
    setEditingId(null);
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h2 className={styles.title}>Gallery Videos</h2>
            <button
              className={styles.syncBtn}
              onClick={syncVideos}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync from Bunny"}
            </button>
          </div>

          <p className={styles.hint}>
            Upload videos in the Bunny Stream dashboard, then sync here to manage visibility and order.
          </p>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Title</span>
              <span>Video ID</span>
              <span>Order</span>
              <span>Visible</span>
            </div>
            {videos.map((v) => (
              <div
                key={v.id}
                className={`${styles.tableRow} ${!v.visible ? styles.hidden : ""}`}
              >
                <span className={styles.titleCell}>
                  {editingId === v.id ? (
                    <form
                      className={styles.editForm}
                      onSubmit={(e) => {
                        e.preventDefault();
                        saveTitle(v.id);
                      }}
                    >
                      <input
                        className={styles.editInput}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                      />
                      <button className={styles.saveBtn} type="submit">
                        Save
                      </button>
                      <button
                        className={styles.cancelBtn}
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      className={styles.titleBtn}
                      onClick={() => startEdit(v)}
                    >
                      {v.title}
                    </button>
                  )}
                </span>
                <span className={styles.idCell}>{v.bunnyVideoId.slice(0, 8)}…</span>
                <span className={styles.orderCell}>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveVideo(v.id, "up")}
                    disabled={videos.indexOf(v) === 0}
                  >
                    ↑
                  </button>
                  <button
                    className={styles.arrowBtn}
                    onClick={() => moveVideo(v.id, "down")}
                    disabled={videos.indexOf(v) === videos.length - 1}
                  >
                    ↓
                  </button>
                </span>
                <button
                  className={`${styles.toggleBtn} ${v.visible ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleVisible(v.id, v.visible)}
                >
                  {v.visible ? "Visible" : "Hidden"}
                </button>
              </div>
            ))}
            {videos.length === 0 && !syncing && (
              <p className={styles.empty}>
                No videos found. Upload videos to Bunny Stream and click "Sync from Bunny".
              </p>
            )}
            {syncing && videos.length === 0 && (
              <p className={styles.empty}>Syncing…</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
```

**Step 2: Create the styles**

Create `src/app/admin/videos/page.module.css` — follow the exact pattern from `src/app/admin/discounts/page.module.css`:

```css
.main {
  padding: 2rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.title {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.hint {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--color-muted);
  margin-bottom: 2rem;
}

.syncBtn {
  padding: 0.5rem 1rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  background-color: var(--color-text);
  color: var(--color-white);
  border: 1px solid var(--color-text);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.syncBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.syncBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.table {
  border: 1px solid var(--color-border);
}

.tableHeader {
  display: grid;
  grid-template-columns: 2fr 1fr 80px 100px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.tableRow {
  display: grid;
  grid-template-columns: 2fr 1fr 80px 100px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
  align-items: center;
}

.tableRow:last-child {
  border-bottom: none;
}

.hidden {
  opacity: 0.4;
}

.titleCell {
  overflow: hidden;
}

.titleBtn {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  transition: text-decoration-color 0.2s ease;
}

.titleBtn:hover {
  text-decoration-color: var(--color-text);
}

.idCell {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--color-muted);
}

.orderCell {
  display: flex;
  gap: 0.25rem;
}

.arrowBtn {
  background: none;
  border: 1px solid var(--color-border);
  padding: 0.15rem 0.4rem;
  font-size: 0.75rem;
  cursor: pointer;
  color: var(--color-text);
  transition: border-color 0.2s ease;
}

.arrowBtn:hover:not(:disabled) {
  border-color: var(--color-text);
}

.arrowBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.editForm {
  display: flex;
  gap: 0.3rem;
  align-items: center;
}

.editInput {
  padding: 0.3rem 0.5rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  flex: 1;
  min-width: 0;
}

.editInput:focus {
  outline: none;
  border-color: var(--color-text);
}

.saveBtn,
.cancelBtn {
  padding: 0.25rem 0.5rem;
  font-family: var(--font-body);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  border: 1px solid;
}

.saveBtn {
  border-color: #2d7a3a;
  color: #2d7a3a;
  background: transparent;
}

.saveBtn:hover {
  background-color: #2d7a3a;
  color: white;
}

.cancelBtn {
  border-color: var(--color-border);
  color: var(--color-muted);
  background: transparent;
}

.cancelBtn:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}

.toggleBtn {
  padding: 0.3rem 0.6rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggleActive {
  border-color: #2d7a3a;
  color: #2d7a3a;
  background: transparent;
}

.toggleActive:hover {
  background-color: #2d7a3a;
  color: white;
}

.toggleInactive {
  border-color: #c0392b;
  color: #c0392b;
  background: transparent;
}

.toggleInactive:hover {
  background-color: #c0392b;
  color: white;
}

.empty {
  padding: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-muted);
  font-style: italic;
}
```

**Step 3: Verify the page renders**

Run: `npm run dev`
Navigate to `/admin/videos` and verify the page loads with the sync button.

**Step 4: Commit**

```bash
git add src/app/admin/videos/
git commit -m "feat: add admin videos page with bunny sync, visibility, and reorder"
```

---

### Task 8: Update Gallery component to fetch videos from API

**Files:**
- Modify: `src/components/Gallery.tsx`

**Step 1: Replace hardcoded videoEntries with API fetch**

In `src/components/Gallery.tsx`:

1. Add a state for video entries and fetch on mount.
2. Remove the hardcoded `videoEntries` array and `VideoEntry` type.
3. Replace with fetched data from `/api/videos`.

Changes:

- Remove lines 41-51 (the `VideoEntry` type and `videoEntries` const)
- Add this interface and state inside the component:

```tsx
interface VideoEntry {
  id: string;
  title: string;
  thumbnail: string;
  src: string;
}
```

- Add state and fetch inside the `Gallery` component (after `sectionRef`):

```tsx
const [videoEntries, setVideoEntries] = useState<VideoEntry[]>([]);

useEffect(() => {
  fetch("/api/videos")
    .then((res) => res.json())
    .then((data) => setVideoEntries(data))
    .catch(() => {});
}, []);
```

- Update `openVideo` to use `v.title` instead of `v.alt`:

```tsx
const openVideo = (i: number) => {
  const items: LightboxItem[] = videoEntries.map((v) => ({
    type: "video",
    src: v.src,
    alt: v.title,
  }));
  setLightbox({ items, index: i });
};
```

- Update the video grid to use `v.title` instead of `v.alt`:

```tsx
<Image
  src={item.thumbnail}
  alt={item.title}
  fill
  sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
  style={{ objectFit: "cover" }}
/>
```

**Step 2: Verify the gallery still renders**

Run: `npm run dev`
Verify the photography section still works and the video section shows "Coming soon" (since no videos are visible yet).

**Step 3: Commit**

```bash
git add src/components/Gallery.tsx
git commit -m "feat: fetch gallery videos from API instead of hardcoded array"
```

---

### Task 9: Update Hero component to use Bunny CDN URL

**Files:**
- Modify: `src/components/Hero.tsx`

**Step 1: Replace hardcoded hero.mp4 with env var**

In `src/components/Hero.tsx`, change the `<source>` tag:

From:
```tsx
<source src="/hero.mp4" type="video/mp4" />
```

To:
```tsx
<source src={process.env.NEXT_PUBLIC_BUNNY_CDN_HERO_URL || "/hero.mp4"} type="video/mp4" />
```

This falls back to the local file if the env var isn't set yet.

**Step 2: Verify hero still works**

Run: `npm run dev`
Verify the hero video still plays (will use local fallback until env var is set).

**Step 3: Commit**

```bash
git add src/components/Hero.tsx
git commit -m "feat: serve hero video from bunny CDN with local fallback"
```

---

### Task 10: Add environment variables

**Files:**
- Modify: `.env.local`

**Step 1: Add the Bunny environment variables**

Add to `.env.local`:

```
# Bunny.net
BUNNY_STREAM_API_KEY=your-api-key-here
BUNNY_STREAM_LIBRARY_ID=your-library-id-here
BUNNY_STREAM_PULL_ZONE=your-pull-zone.b-cdn.net
NEXT_PUBLIC_BUNNY_CDN_HERO_URL=https://your-cdn-url/hero.mp4
```

The user will need to fill in actual values from their Bunny dashboard.

**Step 2: Verify end-to-end**

1. Set real Bunny credentials in `.env.local`
2. Run `npm run dev`
3. Navigate to `/admin/videos` → click "Sync from Bunny" → videos should appear
4. Toggle a video to "Visible"
5. Navigate to the homepage → video section should show the visible video
6. Click the video thumbnail → lightbox should open and play the video
7. Verify hero video loads from Bunny CDN

**Note:** Do NOT commit `.env.local` — it's already gitignored.

---

### Task 11: Add Next.js image domain config for Bunny thumbnails

**Files:**
- Modify: `next.config.ts`

**Step 1: Check current config**

Read `next.config.ts` to see existing config.

**Step 2: Add Bunny hostname to images.remotePatterns**

Add a `remotePatterns` entry for the Bunny pull zone so `next/image` can load thumbnails:

```ts
images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.b-cdn.net",
    },
  ],
},
```

**Step 3: Verify thumbnails load**

Run: `npm run dev`
Navigate to homepage with a visible video → thumbnail should load without Next.js image domain errors.

**Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow bunny CDN images in next.js image config"
```
