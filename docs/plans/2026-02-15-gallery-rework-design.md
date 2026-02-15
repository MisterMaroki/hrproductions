# Gallery Rework Design

## Overview

Rework the single flat gallery into three vertically stacked sections: Photography, Drone Photography, and Videos. Each section gets a tailored grid layout matching its content type while maintaining the site's editorial aesthetic.

## Requirements

- Three distinct vertical sections with bold section headers
- Photography: existing 19 property photos in asymmetric editorial grid
- Drone Photography: cinematic wide-ratio grid, placeholder for future content
- Videos: thumbnail grid with play overlays, lightbox video playback, placeholder for future content
- No editorial text blocks — media speaks for itself
- Consistent with existing design system (Instrument Serif, DM Sans, warm beige, scroll animations, film grain)

## Architecture

### Component Structure

```
Gallery.tsx (reworked)
├── Section Header: "01 — Photography"
│   └── Photography Grid (asymmetric 12-col editorial)
├── Section Header: "02 — Drone"
│   └── Drone Grid (wide/cinematic 2-col with panoramic)
├── Section Header: "03 — Video"
│   └── Video Grid (uniform 3-col with play overlays)
└── Lightbox.tsx (extended for image + video)
```

### Section 1: Photography Grid

- 12-column asymmetric editorial grid (existing pattern, text blocks removed)
- All 19 current property photos
- Varied grid-column spans and aspect ratios (16/9, 4/5, 3/4, 1/1, 21/9)
- Hover: scale 1.03 + brightness + bottom vignette
- Click: opens Lightbox (image mode)
- Staggered scroll-reveal animations via Intersection Observer

### Section 2: Drone Photography Grid

- Wide/cinematic emphasis: 16:9, 21:9, 2:1 aspect ratios
- 2-column layout with occasional full-width panoramic shots
- Placeholder state for future content (empty grid slots)
- Same hover/lightbox behavior as Photography

### Section 3: Videos Grid

- Uniform grid: 3 columns (desktop), 2 (tablet), 1 (mobile)
- 16:9 aspect ratio thumbnails
- Semi-transparent dark overlay with centered play button icon
- Hover: overlay lightens, play button scales up
- Click: opens Lightbox in video mode
- Keyboard: Escape close, arrow key navigation

### Lightbox Extension

- Extended to accept `type` prop: `'image' | 'video'`
- Video mode: renders `<video>` with native controls, autoplay on open
- Video pauses on close or navigation
- Same dark overlay, close button, prev/next navigation

## Design Decisions

- **Vertical scroll over tabs**: keeps all content discoverable, no hidden states
- **Tailored grids per section**: aerial content needs wider ratios, videos need uniform sizing
- **No editorial text**: cleaner, lets media be the focus
- **Extended Lightbox over new component**: reuses existing tested patterns, single source of truth
- **Placeholder approach**: sections render with minimal "coming soon" state rather than being hidden

## Data Model

Gallery items defined as typed arrays:

```typescript
type GalleryItem = {
  src: string
  alt: string
  aspect: string // CSS aspect-ratio value
  span?: number  // grid-column span
}

type VideoItem = {
  src: string
  thumbnail: string
  alt: string
}
```

Photography and drone items are `GalleryItem[]`. Video items are `VideoItem[]`.
