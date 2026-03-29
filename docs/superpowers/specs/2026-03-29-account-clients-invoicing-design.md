# Account Clients & Monthly Invoicing System

## Overview

Add a B2B account layer to HR Productions so estate agent clients can sign up for an account, book unlimited shoots per month without upfront payment, and receive a single monthly invoice collected via GoCardless Direct Debit when Harrison chooses to charge. The existing one-off Stripe booking flow remains untouched for non-account customers.

## Core Concepts

- **Account clients**: estate agents who sign up, get approved by Harrison, set up a GoCardless Direct Debit mandate, and can then book shoots on credit
- **One-off bookings**: the existing public booking flow via Stripe, unchanged
- **Running balance**: cumulative total of completed (but not yet invoiced) shoots for a client
- **Charge event**: Harrison reviews completed shoots, selects which to include, presses charge — GoCardless collects, invoice is sent

---

## Database Schema

### New table: `clients`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| companyName | text | required |
| contactName | text | required |
| email | text | unique, login credential |
| phone | text | required |
| passwordHash | text | bcrypt hashed |
| status | text | `pending_approval` / `active` / `suspended` / `deactivated` |
| gocardlessMandateId | text | nullable, set after mandate setup |
| gocardlessCustomerId | text | nullable |
| bookingsPaused | boolean | default false, auto-set on payment failure |
| createdAt | timestamp | |

`status` controls account access. `bookingsPaused` is a separate flag for automatic payment-failure pausing — independent of `status` so Harrison can unpause without changing account status.

### New table: `invoices`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| clientId | UUID | FK to clients |
| totalAmount | integer | in pence |
| status | text | `pending` / `paid` / `failed` |
| gocardlessPaymentId | text | nullable |
| pdfPath | text | stored invoice PDF path |
| failureReason | text | nullable, from GoCardless webhook |
| chargedAt | timestamp | when Harrison pressed charge |
| paidAt | timestamp | nullable, set by webhook on successful payment |
| createdAt | timestamp | |

### New table: `invoice_items`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| invoiceId | UUID | FK to invoices |
| bookingId | UUID | FK to bookings |
| amount | integer | in pence, the booking total |

Links individual completed bookings to an invoice for audit trail and per-shoot invoice breakdowns.

### Changes to existing `bookings` table

- **Add column**: `clientId` (UUID, nullable, FK to clients) — null means one-off Stripe booking
- **Expand status enum**: `pending`, `confirmed`, `completed`, `invoiced`, `paid`, `cancelled`, `payment_failed`
  - One-off bookings: `pending` → `confirmed` (via Stripe webhook), unchanged
  - Account bookings: `pending` → `completed` → `invoiced` → `paid`
  - `cancelled`: available at any point before `invoiced`
  - `payment_failed`: set when GoCardless payment fails on an `invoiced` booking

---

## Authentication & Middleware

### Client auth

- JWT-based sessions using existing `jose` library
- Separate cookie: `client_session` (HTTP-only, 7-day expiry)
- Separate JWT secret: `CLIENT_JWT_SECRET` env var
- JWT payload includes `clientId` and `clientStatus`

### Middleware updates (`src/middleware.ts`)

Three auth contexts, checked in order:

1. `/admin/*` and `/api/admin/*` → validate `admin_session` cookie (existing)
2. `/portal/*` and `/api/portal/*` → validate `client_session` cookie (except `/portal/login`, `/portal/signup`, `/api/portal/login`, `/api/portal/signup`, `/api/portal/logout` which are public)
3. Everything else → public

Middleware validates the JWT exists and is not expired. Individual portal pages/APIs handle status-specific logic (e.g. `pending_approval` clients can log in and see a "pending" dashboard, but cannot access booking creation; `active` clients with `bookingsPaused = true` can view everything but cannot create new bookings).

### Signup & approval flow

1. Client visits `/portal/signup` (public) → enters company name, contact name, email, phone, password
2. Account created with `status: pending_approval`
3. Harrison notified via email
4. Harrison approves in `/admin/clients` → status set to `active`
5. Client receives approval email: "Set up your payment method to start booking"
6. Client logs in → sees prompt to set up GoCardless mandate
7. GoCardless embedded drop-in component on `/portal/account/setup-mandate`
8. Mandate confirmed via webhook → `gocardlessMandateId` and `gocardlessCustomerId` stored
9. Client can now book shoots

Clients can log in once approved but cannot book until GoCardless mandate is set up.

---

## Client Portal

Lives at `/portal/*`. All pages (except login/signup) require active client session.

### `/portal/login`
Email + password login. Redirects to `/portal/dashboard` on success.

### `/portal/signup`
Registration form. After submission, shows "Your account is pending approval" message.

### `/portal/dashboard`
Main hub showing:
- **Account status banner** — CTA to set up mandate if not done; warning if bookings paused due to failed payment
- **Running total** — cumulative cost of `completed` bookings since last charge, with shoot count
- **Quick stats** — pending shoots upcoming, completed awaiting invoice, total paid to date

### `/portal/bookings`
- "Book new shoot" button (disabled if no mandate or bookings paused)
- List of all client's bookings, filterable by status
- Each booking: address, date, time, services, cost, status badge
- Grouped by status: upcoming (pending), completed, invoiced, paid, cancelled

### `/portal/bookings/new`
Same booking flow as current `/book` page but:
- No agent details section (pulled from client account)
- No payment step — booking goes straight to `pending` status
- Each property in a multi-property booking becomes its own booking record with `clientId` set
- Uses the same availability checking and scheduling logic

### `/portal/invoices`
- List of all invoices: date, amount, status, number of shoots
- Expandable per-shoot breakdown: address, date, services, amount
- Download PDF button per invoice
- Failed payments highlighted with messaging

### `/portal/account`
- View/edit company details, contact info, phone
- Change password
- GoCardless mandate status
- Re-setup mandate option if needed

---

## Admin — Client Management

### `/admin/clients`
New section in admin nav:
- Client list: company name, contact, status, running balance, mandate status
- Filterable by status (pending_approval, active, suspended, deactivated)
- Searchable by company name or email

### `/admin/clients/[id]`
Individual client page with sections:

**Overview:**
- Company details, contact info, account status
- Approve / suspend / deactivate actions
- GoCardless mandate status
- Bookings paused indicator with manual unpause button

**Running Balance:**
- Total of all `completed` bookings not yet invoiced
- List of those shoots with checkboxes: address, date, services, amount
- Harrison can uncheck shoots to exclude from the charge
- "Charge £X.XX" button — creates invoice, triggers GoCardless payment, sends PDF to client, moves bookings to `invoiced`

**Booking History:**
- All bookings for this client, filterable by status

**Invoice History:**
- All invoices for this client with status
- Failed invoices show retry button and failure reason
- Download PDF for any invoice

### Changes to existing admin pages

**`/admin/bookings`:**
- Shows company name for account bookings, "One-off" for Stripe bookings
- Status filter includes new statuses: invoiced, paid, payment_failed

**`/admin/calendar`:**
- Account client bookings show with distinct visual indicator (different colour/badge)
- Status visible on calendar entries (pending vs completed)

---

## GoCardless Integration

### Dependencies
- `gocardless-nodejs` package
- Environment vars: `GOCARDLESS_ACCESS_TOKEN`, `GOCARDLESS_ENVIRONMENT` (sandbox/live), `GOCARDLESS_WEBHOOK_SECRET`

### Mandate Setup
- Client triggers mandate setup from portal
- API creates GoCardless Billing Request Flow
- Embedded drop-in component renders on `/portal/account/setup-mandate`
- On completion, GoCardless webhook fires → store `mandateId` and `customerId` on client record

### Charge Flow
When Harrison presses "Charge" on a client:

1. Create `invoices` record with status `pending`, linked to selected bookings via `invoice_items`
2. Generate PDF invoice (extend existing `invoice-pdf.ts` for multi-shoot cumulative format)
3. Create GoCardless payment against client's mandate for total amount
4. Update selected bookings to `invoiced` status
5. Send invoice email to client with PDF attached
6. Return confirmation to admin UI

### Webhook endpoint: `/api/webhook/gocardless`
Validates webhook signature, handles events:

- **`payments.paid_out`** → invoice status to `paid`, set `paidAt`, bookings to `paid`
- **`payments.failed`** → invoice status to `failed`, store `failureReason`, set `bookingsPaused = true` on client, bookings to `payment_failed`, email Harrison and client
- **`mandates.cancelled`** / **`mandates.failed`** → clear mandate from client, pause bookings, notify both parties

### Retry Flow
When Harrison clicks "Retry" on a failed invoice:

1. If mandate still active: create new GoCardless payment, reset invoice to `pending`, bookings back to `invoiced`
2. If mandate invalid: prompt that client needs to set up a new mandate
3. On successful payment clearing: `bookingsPaused` automatically set to false

---

## Email Notifications

All via existing Resend integration:

| Event | Recipient | Content |
|-------|-----------|---------|
| Client signs up | Harrison | "New account pending approval: [company]" |
| Account approved | Client | "Account active — set up your payment method" |
| Account suspended/deactivated | Client | "Your account has been [status]" |
| Booking placed by client | Harrison | "New booking from [company]: [address] on [date]" |
| Booking cancelled | Client | "[Address] on [date] has been cancelled" |
| Invoice & charge | Client | "Invoice for £X.XX — [N] shoots" with PDF |
| Payment successful | Client | "Payment of £X.XX received" |
| Payment failed | Client | "Payment failed — bookings paused until resolved" |
| Payment failed | Harrison | "Payment failed for [company]: £X.XX, reason: [reason]" |
| Mandate cancelled/failed | Both | Mandate no longer valid, action needed |

Existing one-off Stripe booking emails remain unchanged.

---

## API Routes

### New public routes
- `POST /api/portal/signup` — create client account
- `POST /api/portal/login` — client authentication
- `POST /api/portal/logout` — clear client session

### New client routes (`/api/portal/*`, auth required)
- `GET /api/portal/dashboard` — running total, stats
- `GET /api/portal/bookings` — list client bookings (filterable)
- `POST /api/portal/bookings` — create new booking(s) on account
- `GET /api/portal/invoices` — list client invoices
- `GET /api/portal/invoices/[id]/pdf` — download invoice PDF
- `GET /api/portal/account` — get account details
- `PATCH /api/portal/account` — update account details
- `POST /api/portal/account/change-password` — change password
- `POST /api/portal/account/setup-mandate` — initiate GoCardless mandate flow
- `GET /api/portal/account/mandate-status` — check mandate setup status

### New admin routes (`/api/admin/*`, admin auth required)
- `GET /api/admin/clients` — list clients (filterable, searchable)
- `GET /api/admin/clients/[id]` — client detail with running balance
- `PATCH /api/admin/clients/[id]` — update client status (approve, suspend, deactivate, unpause)
- `POST /api/admin/clients/[id]/charge` — charge client for selected bookings
- `POST /api/admin/invoices/[id]/retry` — retry failed payment
- `GET /api/admin/clients/[id]/invoices` — client invoice history

### New webhook route
- `POST /api/webhook/gocardless` — GoCardless payment and mandate events

---

## Data Model for Future Cancellation Policy

The `bookings` table and `cancelled` status are sufficient for a future cancellation policy. When implemented:
- Add `cancelledAt` timestamp and `cancelledBy` (client/admin) columns to bookings
- Add `cancellationFee` column (integer, pence) for late cancellation charges
- Cancellation fees would be included as line items on the next invoice
- Policy rules (e.g. "within 24 hours = 50% fee") would be configurable in admin

No code for this now — just noting the schema is extensible for it.

---

## What Stays Unchanged

- Public website (homepage, gallery, services, contact)
- One-off booking flow at `/book` via Stripe
- Stripe webhook and checkout flow
- Discount codes system
- Gallery management (photos/videos)
- Blocked days management
- All existing public API routes
