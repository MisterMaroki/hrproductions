# CMS Backend Design

## Overview

Add a lightweight CMS backend for Harrison to manage discount codes, view bookings on a calendar, and control scheduling. Uses Turso (hosted SQLite) + Drizzle ORM + custom cookie-based auth.

## Stack

- **Database**: Turso (hosted libSQL/SQLite) — works with Vercel serverless
- **ORM**: Drizzle ORM — type-safe, lightweight, SQLite-compatible
- **Auth**: Custom credentials auth — bcrypt password check, JWT session cookie
- **Admin UI**: Next.js server-rendered pages under `/admin`
- **Deployment**: Vercel (existing)

## Database Schema

### bookings

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| address | TEXT NOT NULL | Property address |
| bedrooms | INTEGER NOT NULL | |
| preferred_date | TEXT NOT NULL | YYYY-MM-DD |
| notes | TEXT | Access info |
| agent_name | TEXT NOT NULL | |
| agent_company | TEXT | |
| agent_email | TEXT NOT NULL | |
| agent_phone | TEXT | |
| services | TEXT NOT NULL | JSON blob of selected services |
| work_hours | REAL NOT NULL | Calculated shoot hours |
| subtotal | INTEGER NOT NULL | Pence |
| discount_code | TEXT | Code used (nullable) |
| discount_amount | INTEGER DEFAULT 0 | Pence saved |
| total | INTEGER NOT NULL | Pence |
| stripe_session | TEXT | Stripe session ID |
| status | TEXT DEFAULT 'confirmed' | confirmed, completed, cancelled |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

One row per property. Multi-property orders share the same stripe_session.

### discount_codes

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| code | TEXT NOT NULL UNIQUE | Uppercase, e.g. "SUMMER25" |
| percentage | INTEGER NOT NULL | e.g. 25 for 25% off |
| active | INTEGER DEFAULT 1 | 0 = disabled |
| max_uses | INTEGER | Nullable = unlimited |
| times_used | INTEGER DEFAULT 0 | |
| expires_at | TEXT | Nullable, YYYY-MM-DD |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

### blocked_days

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| date | TEXT NOT NULL UNIQUE | YYYY-MM-DD |
| reason | TEXT | e.g. "Holiday" |
| created_at | TEXT DEFAULT CURRENT_TIMESTAMP | |

## Scheduling Logic

Work hours per service:
- Photography only: 1 hour
- Unpresented video: 1 hour
- Agent-presented video: 2 hours
- Drone photography: 0.5 hours (add-on time)
- Video drone footage: included in video time

Max 6 hours per day total (4 hours shoot + 2 hours travel buffer). API sums work_hours for all confirmed bookings on a date, rejects dates that would exceed limit.

## Auth

- `ADMIN_USER` and `ADMIN_PASSWORD_HASH` (bcrypt) in env vars
- `ADMIN_JWT_SECRET` for signing session cookies
- POST `/api/admin/login` checks credentials, sets HTTP-only signed JWT cookie (24h expiry)
- POST `/api/admin/logout` clears cookie
- `middleware.ts` protects all `/admin/*` routes (except `/admin/login`)

## API Routes

### Admin (protected by auth middleware)

- GET /api/admin/bookings — list bookings (date filters)
- PATCH /api/admin/bookings/:id — update status
- GET /api/admin/discounts — list codes
- POST /api/admin/discounts — create code
- PATCH /api/admin/discounts/:id — update/deactivate
- GET /api/admin/blocked-days — list blocked days
- POST /api/admin/blocked-days — block a day
- DELETE /api/admin/blocked-days/:id — unblock

### Public (frontend)

- POST /api/discount/validate — validate code, return percentage
- GET /api/availability?date=YYYY-MM-DD — check date capacity

### Webhook

- POST /api/webhook/stripe — handles checkout.session.completed, creates booking rows

## Admin Pages

- `/admin/login` — login form
- `/admin` — redirects to /admin/calendar
- `/admin/calendar` — monthly calendar with bookings, blocked days, capacity indicators
- `/admin/discounts` — CRUD table for discount codes

## Frontend Changes

### Discount code input (BookingSection)

- Text input + "Apply" button above basket
- Calls /api/discount/validate on apply
- Shows applied discount with remove option
- Discount percentage passed to Basket, applied to grand total
- Sent to checkout API and stored with booking

### Date validation (PropertyBlock)

- On date selection, checks /api/availability
- Shows warning if day is blocked or full
- Prevents submission for unavailable dates

### Booking flow update

1. Customer fills form, selects date, applies discount (optional)
2. Pays via Stripe checkout
3. Stripe webhook fires → booking rows created in DB
4. Success page shown
5. Harrison sees booking on admin calendar

## Stripe Webhook

POST /api/webhook/stripe:
1. Verify Stripe signature (STRIPE_WEBHOOK_SECRET env var)
2. Handle checkout.session.completed event
3. Parse metadata (agent info, properties, services, discount)
4. Create booking rows in DB (one per property)
5. Increment discount_codes.times_used if applicable

## New Environment Variables

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
ADMIN_USER=harrison
ADMIN_PASSWORD_HASH=$2b$...
ADMIN_JWT_SECRET=...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Files to Create/Modify

### New files
- `src/lib/db.ts` — Drizzle client + Turso connection
- `src/lib/schema.ts` — Drizzle table definitions
- `src/lib/auth.ts` — JWT helpers (sign, verify, cookie management)
- `src/lib/scheduling.ts` — Work hours calculation, capacity checking
- `src/middleware.ts` — Auth middleware for /admin routes
- `src/app/admin/login/page.tsx` — Login page
- `src/app/admin/calendar/page.tsx` — Calendar page
- `src/app/admin/discounts/page.tsx` — Discounts management page
- `src/app/admin/layout.tsx` — Admin layout (nav, sidebar)
- `src/app/api/admin/login/route.ts`
- `src/app/api/admin/logout/route.ts`
- `src/app/api/admin/bookings/route.ts`
- `src/app/api/admin/discounts/route.ts`
- `src/app/api/admin/blocked-days/route.ts`
- `src/app/api/discount/validate/route.ts`
- `src/app/api/availability/route.ts`
- `src/app/api/webhook/stripe/route.ts`
- `drizzle.config.ts` — Drizzle config for migrations

### Modified files
- `src/components/BookingSection.tsx` — discount code input, pass to checkout
- `src/components/Basket.tsx` — apply discount percentage to total
- `src/app/api/checkout/route.ts` — include discount in Stripe line items, pass to metadata
- `package.json` — add drizzle-orm, @libsql/client, bcryptjs, jose
