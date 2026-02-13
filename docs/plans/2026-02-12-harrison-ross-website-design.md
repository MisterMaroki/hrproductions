# Harrison Ross — Property Videography & Photography Website

## Overview

Single-page scroll website for Harrison Ross, a property videographer and photographer serving estate agents. Built in Next.js. Brutalist minimalist design inspired by 1273.co.uk/redesign.

Estate agents land on the site, see Harrison's work, check pricing, and book multiple properties with a multi-select service basket that redirects to Stripe Payment Links for checkout.

## Brand

- **Name:** Harrison Ross (placeholder — may change)
- **Tone:** Professional, minimal, confident. Let the work speak.
- **Target audience:** Estate agents looking to book property media services

## Design System

| Element            | Value                                      |
| ------------------ | ------------------------------------------ |
| Background         | #FAFAFA (off-white)                        |
| Text               | #0A0A0A (near-black)                       |
| Borders            | 1px solid #0A0A0A                          |
| Headlines          | Instrument Serif (Georgia fallback)        |
| Body               | DM Sans (system sans fallback)             |
| Corners            | 0 (sharp everywhere)                       |
| Shadows            | None                                       |
| Animations         | Fade-in on scroll (0.5s ease-out), smooth scroll |
| Max content width  | 1200px                                     |
| Section spacing    | ~8rem vertical padding                     |

## Tech Stack

- **Framework:** Next.js (App Router)
- **Styling:** CSS (matching brutalist approach — no UI libraries)
- **Fonts:** Google Fonts (Instrument Serif, DM Sans)
- **Payment:** Stripe Payment Links (frontend redirect, no backend needed)
- **Deployment:** Vercel

## Services & Pricing

### Photography
- £6.50 per photo
- Minimum 20 photos per property
- 10% discount at 100+ photos per property

### Property Video
- Base price: £125 (2-bed)
- +£30 per additional bedroom
- Professional editing included

### Drone Footage
- +£65 add-on to any video package

### Agent Presented Video
- 1.5x the standard video price (same bedroom scaling)
- 2-bed base: £187.50, +£45 per extra bedroom
- Harrison directs, agent presents on camera

## Site Sections

### 1. Navigation (Fixed)

Fixed top bar. Transparent over hero, transitions to off-white (#FAFAFA) with 1px bottom rule on scroll.

- **Left:** "Harrison Ross" in Instrument Serif — scrolls to top on click
- **Right:** "Work" · "Services" · "Book" — DM Sans, smooth-scroll anchor links
- **Mobile:** All three links fit inline (no hamburger). Text shrinks slightly.

### 2. Hero (Full Viewport)

Edge-to-edge image (placeholder for future autoplay video). Dark overlay ~60% opacity.

- "Harrison Ross" — large Instrument Serif, white
- "Property videography & photography for estate agents" — DM Sans, white
- "Book a Shoot" CTA button — scrolls to booking section
- Subtle down-arrow at bottom, fades in

When video is added later, the image swaps to a muted autoplay loop. No structural changes needed.

### 3. Portfolio Gallery ("Work")

Section header: "Work" in Instrument Serif, left-aligned, with full-width 1px horizontal rule underneath.

- Masonry grid: 3 columns desktop, 2 tablet, 1 mobile
- 4px gap between images
- No captions or labels
- Click to open full-screen lightbox (black background, fade-in, left/right navigation, close button top-right)
- All 19 images from `/images/` directory
- Future: video thumbnails and/or photo/video filter toggle

### 4. Services & Pricing ("Services")

Section header: "Services" — same treatment as portfolio.

4 cards in a row (desktop), 2 (tablet), stacked (mobile). Each card: white background, 1px black border, no rounded corners, no shadows.

**Card 1 — Photography:**
- "From £130" (20 × £6.50)
- "£6.50 per photo · Min 20 per property"
- "10% off for 100+ photos"

**Card 2 — Property Video:**
- "From £125"
- "2-bed base · +£30 per extra bedroom"
- "Professional edit included"

**Card 3 — Drone Footage:**
- "+£65"
- "Add-on to any video package"
- "Aerial property & surroundings"

**Card 4 — Agent Presented Video:**
- "From £187.50"
- "Guided tour with your agent on camera"
- "Directed by Harrison · +£45 per extra bedroom"

Typography: service name in Instrument Serif, pricing in bold DM Sans, descriptions in regular DM Sans. Each card has a "Book Now" link that scrolls to booking section.

### 5. Booking Form + Basket ("Book")

Section header: "Book" — same treatment.

Two-column layout on desktop (stacked on mobile): form left (~60%), sticky basket right (~40%).

#### Left Column: Form

**Agent Details (collected once):**
- Agent name
- Company
- Email
- Phone

**Property Blocks (repeatable):**
Each property is a bordered block containing:
- Property address (text input)
- Number of bedrooms (dropdown: 2, 3, 4, 5, 6+)
- Preferred date (date picker)
- Service toggles (multi-select pill/chip buttons):
  - Photography → reveals photo count input (default 20, min 20)
  - Property Video
  - Drone Footage (only enabled when a video type is selected)
  - Agent Presented Video

**Business rules:**
- Property Video and Agent Presented Video are mutually exclusive
- Drone Footage is an add-on to either video type (disabled if no video selected)
- Photography photo count minimum enforced at 20

**"+ Add Another Property"** button below the property blocks. Each block shows its subtotal inline.

#### Right Column: Sticky Basket

Live-updating summary:
- Each property listed by address
- Line items with individual prices
- Subtotal per property
- Automatic "10% bulk discount applied" note when any property hits 100+ photos
- **Total** in bold at bottom
- **"Proceed to Payment"** — full-width, black background, white text button. Redirects to Stripe Payment Link.

#### Mobile Basket

Fixed bottom bar showing total + "View Basket" toggle. Slides up the full summary. "Proceed to Payment" button always visible in this bar.

### 6. Footer

Separated by 1px rule. Single row:
- **Left:** "Harrison Ross" in Instrument Serif (small)
- **Centre:** Email + phone in DM Sans
- **Right:** Instagram icon link (if available)

No fat footer. No copyright line. Only what's needed.

## Stripe Integration

Using Stripe Payment Links (no backend required):
- Build the basket on the frontend with calculated line items
- Redirect to Stripe Payment Link with basket contents
- Stripe handles payment collection
- Harrison receives payment notification with order details

Agent details and property information are encoded in the Stripe Payment Link metadata/line item descriptions so Harrison has all booking context.

## Image Assets

19 property photos currently in `/images/`:
- IMG_2897.JPG through IMG_2916.JPG
- Mix of kitchens, bedrooms, living rooms
- High quality interior shots

Images will need optimization (WebP conversion, responsive sizes) during build.
