# Bunny.net Video Integration Design

## Overview

Integrate bunny.net for all video content on The Property Room site:
- **Bunny Stream** for gallery showcase videos (adaptive encoding, thumbnails, CDN delivery)
- **Bunny CDN** for the hero background video (raw MP4 via pull zone)
- **Admin panel** for managing which videos appear on the site, synced from Bunny's API

## Database Schema

New `gallery_videos` table in Turso (Drizzle ORM):

| Column | Type | Description |
|--------|------|-------------|
| `id` | text (PK) | UUID |
| `bunny_video_id` | text (unique) | Bunny Stream video GUID |
| `title` | text | Display title (defaults to Bunny video title) |
| `sort_order` | integer | Controls display order in gallery |
| `visible` | integer (default 0) | 1 = shown in gallery, 0 = hidden |
| `created_at` | text | Timestamp |

## Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `BUNNY_STREAM_API_KEY` | Server-only | Bunny Stream API key for fetching video list |
| `BUNNY_STREAM_LIBRARY_ID` | Server-only | Bunny Stream library ID |
| `BUNNY_STREAM_PULL_ZONE` | Server-only | Stream pull zone hostname (e.g. `vz-abcdef-123.b-cdn.net`) |
| `NEXT_PUBLIC_BUNNY_CDN_HERO_URL` | Client | Direct CDN URL for the hero background video |

Note: `BUNNY_STREAM_PULL_ZONE` is server-only because video URLs are constructed in API routes and passed to the client as full URLs.

## Admin Panel — `/admin/videos`

### Sync Flow

1. Admin page loads and calls `GET /api/admin/videos/sync`
2. Server fetches all videos from Bunny Stream API: `GET https://video.bunnycdn.com/library/{libraryId}/videos`
3. Syncs with local DB:
   - New videos from Bunny → inserted with `visible=0`, title from Bunny
   - Videos deleted from Bunny → removed from local DB
   - Existing videos → local metadata (title, sort_order, visible) preserved
4. Returns the merged list

### Admin Controls

- Toggle visibility (show/hide in gallery)
- Reorder videos (up/down sort order)
- Edit display title (overrides Bunny's default title)

### API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/admin/videos/sync` | GET | Admin JWT | Sync Bunny videos with local DB, return full list |
| `/api/admin/videos` | PATCH | Admin JWT | Update video visibility, sort_order, or title |

### Upload Flow

Videos are uploaded via the Bunny Stream dashboard (not through our admin panel). Refresh the admin page to sync new uploads.

## Gallery Component Changes

- Replace hardcoded `videoEntries` array with data fetched from `GET /api/videos` (public route)
- Public route returns only `visible=1` videos, ordered by `sort_order`
- Each video entry provides:
  - Thumbnail: `https://{BUNNY_STREAM_PULL_ZONE}/{bunnyVideoId}/thumbnail.jpg`
  - Play URL: `https://{BUNNY_STREAM_PULL_ZONE}/{bunnyVideoId}/play_720p.mp4`
  - Title for alt text

## Lightbox

No changes needed. Existing `<video controls autoPlay playsInline>` works with Bunny's direct MP4 URLs.

## Hero Component Changes

Replace hardcoded `/hero.mp4` source with `NEXT_PUBLIC_BUNNY_CDN_HERO_URL` env var. All other attributes (autoPlay, muted, loop, playsInline) stay the same.

## Admin Navigation

Add "Videos" link to `AdminNav` component alongside Calendar and Discounts.
