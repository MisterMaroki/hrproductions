# Dynamic Services & Pricing System

## Overview

Replace hardcoded pricing in `pricing.ts` with a fully dynamic, database-driven services and pricing system. Admins can create, edit, hide, and delete services with custom pricing formulas, organize them into categories, and configure separate pricing/visibility per brand (main vs white-label).

## Database Schema (Turso/Drizzle)

### `serviceCategories`

| Column | Type | Notes |
|--------|------|-------|
| id | text (nanoid) | PK |
| name | text | e.g. "Photography", "Video", "Floor Plans" |
| sortOrder | integer | Display ordering |
| createdAt | integer | Timestamp |

### `services`

| Column | Type | Notes |
|--------|------|-------|
| id | text (nanoid) | PK |
| categoryId | text | FK -> serviceCategories |
| name | text | e.g. "Standard Video" |
| description | text (nullable) | Shown on booking form |
| pricingRules | text (JSON) | Formula engine config |
| durationRules | text (JSON) | Scheduling duration config |
| inputFields | text (JSON) | Custom inputs needed from user |
| isAddon | integer (boolean) | Whether this is an add-on to another service (default 0) |
| parentServiceId | text (nullable) | FK -> services, for add-ons |
| sortOrder | integer | Within category |
| visible | integer (boolean) | Global visibility (default 1) |
| createdAt | integer | |
| updatedAt | integer | |

### `serviceBrandOverrides`

| Column | Type | Notes |
|--------|------|-------|
| id | text (nanoid) | PK |
| serviceId | text | FK -> services |
| brandMode | text | "main" or "whitelabel" |
| visible | integer (boolean) | Show/hide on this brand |
| pricingRules | text (JSON, nullable) | Override pricing (null = use service default) |
| durationRules | text (JSON, nullable) | Override duration (null = use default) |
| inputFields | text (JSON, nullable) | Override inputs (null = use default) |

Unique constraint on `(serviceId, brandMode)`.

**Resolution logic:** For a given brand, look up override. If override exists and field is non-null, use override value. Otherwise fall back to service default. If override `visible` is false (or no override and service `visible` is false), hide it.

## Pricing Rule Engine

### pricingRules JSON shape

```json
{
  "basePrice": 100,
  "rules": [
    { "type": "perUnit", "input": "bedrooms", "rate": 25, "freeUnits": 2 },
    { "type": "bulkDiscount", "input": "photos", "threshold": 100, "percent": 10 },
    { "type": "fixedTier", "tiers": [{ "label": "8 photos", "value": 8, "price": 75 }] },
    { "type": "minimum", "input": "photos", "minValue": 20 },
    { "type": "flatRate" }
  ]
}
```

### Rule types

| Type | Formula | Example |
|------|---------|---------|
| `perUnit` | `rate * max(0, input - freeUnits)` | +£25 per bedroom over 2 |
| `bulkDiscount` | `-percent%` when `input >= threshold` | 10% off at 100+ photos |
| `fixedTier` | User picks a tier, price replaces basePrice | Drone: 8 photos £75 / 20 photos £140 |
| `minimum` | Enforces `input >= minValue` (validation, not pricing) | Min 20 photos |
| `flatRate` | Price is just `basePrice`, no scaling | Drone video add-on £65 |

Rules are evaluated top-to-bottom. `perUnit` rules add to the base. `bulkDiscount` applies to the running total. `fixedTier` replaces the base entirely (mutually exclusive with `perUnit`).

### inputFields JSON shape

```json
[
  { "key": "bedrooms", "label": "Number of Bedrooms", "type": "number", "min": 1, "max": 20, "default": 2 },
  { "key": "photos", "label": "Number of Photos", "type": "number", "min": 20, "max": 500, "default": 20 },
  { "key": "floorplanType", "label": "Floor Plan Type", "type": "select", "options": [
    { "value": "standard", "label": "Standard" },
    { "value": "premium", "label": "Premium" }
  ]}
]
```

Input types: `number`, `select`, `boolean` (checkbox).

The key `bedrooms` is special — it's collected at the property level and shared across all services for that property. The engine pulls it from property data automatically.

### durationRules JSON shape

```json
{
  "baseMinutes": 40,
  "scaling": { "input": "photos", "rate": 5, "freeUnits": 20 }
}
```

`scaling` is optional. If omitted, duration = `baseMinutes`.

### Shared evaluation functions

- `evaluatePrice(pricingRules, userInputs)` -> `{ total: number, breakdown: LineItem[] }`
- `evaluateDuration(durationRules, userInputs)` -> `number` (minutes)
- `validateInputs(inputFields, userInputs)` -> `{ valid: boolean, errors: Record<string, string> }`

These run on both client (real-time basket) and server (checkout validation). Located in a shared `src/lib/pricing-engine.ts`.

## Admin UI (`/admin/services`)

### Service Categories Management

- List categories with drag-to-reorder (or up/down arrows)
- Create/rename/delete categories
- Deleting a category requires moving or deleting its services first

### Service CRUD

- List all services grouped by category
- **Create service:** Name, description, category, pricing rules, duration rules, input fields
- **Edit service:** All fields editable
- **Hide service:** Toggle global visibility
- **Delete service:** Soft delete or hard delete (hard delete only if no bookings reference it; soft delete = hide otherwise)
- **Reorder:** Within category

### Pricing Rules Editor (friendly UI, not raw JSON)

For each service, the admin sees:

1. **Base price:** `£ [___]`
2. **Pricing type:** Radio select
   - "Fixed price" (flatRate — just the base, done)
   - "Scales with input" (perUnit — shows: `+ £[___] per [input dropdown] above [___]`)
   - "Tiered options" (fixedTier — shows: add/remove tiers, each with label + price)
3. **Optional modifiers:** Checkboxes
   - "Minimum quantity" -> `[input dropdown] must be at least [___]`
   - "Bulk discount" -> `[___]% off when [input dropdown] is [___] or more`

### Input Fields Editor

- Add/remove custom input fields
- Each field: key (auto-generated slug), label, type (number/select/boolean), constraints (min/max/options)
- Checkbox: "Use property bedrooms" (auto-populates `bedrooms` key)

### Brand Overrides Panel

For each service, a "Brand Pricing" section with tabs: "Default" | "Main Site" | "White Label"

- **Default tab:** The base service config (what we just described)
- **Main Site / White Label tabs:** Toggle visibility + optionally override pricing rules, duration, or input fields
- Override fields show "Using default" with a button to "Customize" that copies the default and lets them edit
- "Reset to default" button to clear override

## Booking Form Changes

### Dynamic rendering (`PropertyBlock.tsx`)

Instead of hardcoded service checkboxes, the form:

1. Fetches active services for the current brand via API (`GET /api/services?brand=main|whitelabel`)
2. Renders services grouped by category
3. For each service:
   - Checkbox to select it
   - Dynamic input fields based on `inputFields` config
   - Add-on services shown nested under parent
4. `bedrooms` input collected once at property level, shared to all services

### Dynamic pricing (`Basket.tsx`)

- Uses `evaluatePrice()` client-side for real-time totals
- Each selected service shows its computed price with breakdown
- Multi-property discount still applies (configurable as a system setting or special service)

## Checkout & Payment Changes

### `/api/checkout/route.ts`

- Fetches services from DB instead of using hardcoded `pricing.ts`
- Validates service selections against current pricing (server-side `evaluatePrice()`)
- Builds Stripe line items dynamically from service names and computed prices
- Stores service IDs + user inputs in booking metadata

### Booking record

The existing `services` JSON column on `bookings` table stores the selected service IDs and user inputs:

```json
[
  { "serviceId": "abc123", "inputs": { "bedrooms": 3 }, "computedPrice": 150, "computedDuration": 50 },
  { "serviceId": "def456", "inputs": { "photos": 40 }, "computedPrice": 260, "computedDuration": 50 }
]
```

Price is computed at checkout time and stored — so even if pricing changes later, historical bookings retain their original price.

## Scheduling Changes

### `scheduling.ts`

- Replace hardcoded duration calculations with `evaluateDuration()` calls
- `getWorkHours(services)` iterates over selected services, sums their evaluated durations
- Travel buffer (30 min) remains hardcoded as system-level config

## Migration Strategy

### Seed data

On first deploy, a migration script creates the existing services as database records:

- Category "Photography" -> Photography, Drone Photography
- Category "Video" -> Standard Video, Agent Presented Video, Social Media Video (Unpresented), Social Media Video (Presented), Drone Video Add-on
- Category "Floor Plans" -> Standard, Premium, 3D

Each seeded with their current pricing rules translated to the JSON format.

### Backward compatibility

- The old `pricing.ts` functions are replaced by the engine but the seeded data produces identical prices
- Existing bookings already store computed prices in their `services` JSON and `subtotal`/`total` fields, so they're unaffected
- The `PropertyBlock` and `Basket` components get rewritten to use dynamic service data

### What gets deleted

- `src/lib/pricing.ts` — replaced entirely by `src/lib/pricing-engine.ts` + database
- Hardcoded service references in `PropertyBlock.tsx`, `Basket.tsx`, `BookingSection.tsx`
- Hardcoded duration calculations in `scheduling.ts`

## Multi-Property Discount

Kept as a system-level setting (not a service). Stored in a simple `systemSettings` key-value table or as a constant in the admin panel. Can also have a brand override. The admin can set "£X off per additional property" per brand.

## API Endpoints

### Public

- `GET /api/services?brand=main|whitelabel` — returns active services with resolved pricing for the brand
- Existing `/api/checkout` and `/api/availability` updated to use dynamic services

### Admin

- `GET /api/admin/services` — all services with overrides
- `POST /api/admin/services` — create service
- `PUT /api/admin/services/[id]` — update service
- `DELETE /api/admin/services/[id]` — delete service
- `GET /api/admin/service-categories` — list categories
- `POST /api/admin/service-categories` — create category
- `PUT /api/admin/service-categories/[id]` — update category
- `DELETE /api/admin/service-categories/[id]` — delete category
- `PUT /api/admin/services/[id]/brand-override` — set brand override
- `DELETE /api/admin/services/[id]/brand-override/[brandMode]` — remove brand override
- `PUT /api/admin/services/reorder` — bulk update sort orders
- `PUT /api/admin/service-categories/reorder` — bulk update sort orders

## Testing

- Unit tests for `evaluatePrice()`, `evaluateDuration()`, `validateInputs()` covering all rule types
- Seed data produces prices identical to current hardcoded `pricing.ts` for all service/bedroom combinations
- Integration test: create service via admin API, verify it appears in `/api/services`, select it in a booking, verify checkout computes correct price
