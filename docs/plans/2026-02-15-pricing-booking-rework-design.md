# Pricing & Booking Rework Design

## Overview

Rework the booking system: update pricing model, add drone photography as independent service, restructure video drone add-ons, add notes/access field per property, add multi-property discount, add disclaimer section, rename services.

## Changes Summary

### Pricing

| Service | Price |
|---------|-------|
| Photography | £6.50/photo, min 20, 10% off at 100+ (unchanged) |
| Drone Photography (NEW) | £75 for 8 photos, £140 for 20 photos |
| Unpresented Property Video (renamed from "Property Video") | £125 base + £30/extra bed (unchanged) |
| Agent Presented Video | 1.5× standard video (unchanged) |
| Drone add-on on video | £65, nested inside each video option |
| Multi-property discount | £15 off each property after the first |

### Services.tsx Display Cards

- Card 1: Photography — unchanged
- Card 2: Drone Photography (renamed from "Drone Footage") — £75 for 8 photos / £140 for 20
- Card 3: Unpresented Property Video (renamed from "Property Video") — from £125
- Card 4: Agent Presented Video — unchanged

### PropertyBlock Changes

New fields:
- `notes` (string) — textarea after date field, placeholder: "Key/lockbox codes, parking info, access instructions..."
- `dronePhotography` (boolean) — independent toggle
- `dronePhotoCount` (8 | 20) — dropdown when drone photography enabled
- `standardVideoDrone` (boolean) — nested checkbox under unpresented video
- `agentPresentedVideoDrone` (boolean) — nested checkbox under agent-presented video

Removed fields:
- `drone` (old standalone toggle requiring video)

Service toggle structure:
```
☐ Photography               [count: 20 ▾]
☐ Drone Photography          [8 photos — £75 ▾ / 20 photos — £140]
☐ Unpresented Property Video  [bedroom dropdown]
   └─ ☐ Add drone footage (+£65)
☐ Agent Presented Video        [bedroom dropdown]
   └─ ☐ Add drone footage (+£65)
```

Video types remain mutually exclusive. Drone add-on checkbox only visible when its parent video is toggled on. Switching video type resets the other video's drone add-on.

### PropertyBooking Interface

```typescript
interface PropertyBooking {
  id: string;
  address: string;
  bedrooms: number;
  preferredDate: string;
  notes: string;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
}
```

### Disclaimer Section

Below booking form, styled with muted editorial typography:

- Unpresented videos: 1 hour allocated per shoot
- Agent-presented videos: 2 hours allocated per shoot
- Properties within 10 miles of Brighton included; beyond 10 miles incurs per-mile travel charge quoted separately
- Multi-property same-day bookings: £15 off each additional property
- All prices exclusive of VAT

### Basket Updates

- Shows drone photography as its own line item per property
- Shows video drone add-on as indented sub-line under video
- Multi-property discount shown as a separate line after all properties: "Multi-property discount (N properties) — -£X"
- Grand total reflects discount

### Stripe Checkout Updates

- Drone photography: separate line item "Drone Photography (8 photos)" or "(20 photos)"
- Video drone: "Drone Footage (with Unpresented Video)" or "(with Agent Presented Video)"
- Multi-property discount: negative-amount line item
- Notes field: included in metadata for the property

### pricing.ts Updates

New constants:
```
DRONE_PHOTO_8_PRICE = £75
DRONE_PHOTO_20_PRICE = £140
DRONE_VIDEO_PRICE = £65 (renamed from DRONE_PRICE)
MULTI_PROPERTY_DISCOUNT = £15
```

New functions:
- `calcDronePhotography(count: 8 | 20): number`
- `calcMultiPropertyDiscount(propertyCount: number): number`

Updated:
- `calcPropertyTotal` — add dronePhotography, standardVideoDrone, agentPresentedVideoDrone
- Remove old `calcDrone` or rename to `calcVideoDrone`

## Files Affected

- `src/lib/pricing.ts` — new constants and functions
- `src/components/Services.tsx` — rename cards, update pricing display
- `src/components/PropertyBlock.tsx` — add notes, drone photography, video drone add-ons, remove old drone
- `src/components/PropertyBlock.module.css` — styles for new fields
- `src/components/BookingSection.tsx` — update PropertyBooking interface, add disclaimer section, update default property
- `src/components/BookingSection.module.css` — disclaimer styles
- `src/components/Basket.tsx` — new line items, multi-property discount
- `src/app/api/checkout/route.ts` — new Stripe line items, discount, notes in metadata
