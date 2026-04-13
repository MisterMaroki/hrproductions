# Whitelabel Client Portal

## Goal

Provide a logged-in area on the whitelabel deployment for Harrison's employer. One shared login for the company. Staff see their bookings, start new bookings (agent details locked to the company's identity), and download past invoices Harrison has issued.

## Why

The whitelabel deployment currently has no portal — bookings and invoices are only visible to Harrison's admin. The employer needs a simple self-service view of their schedule and invoice history, but doesn't need per-user accounts, password reset, or account management. A single shared credential is sufficient because there is exactly one counterparty.

## Architecture

**Brand-aware, no new URL paths.** The existing `/portal/*` routes behave differently based on `isWhiteLabel()`. On the main deployment the portal continues to serve trade account clients; on the whitelabel deployment the same paths serve the employer's shared login. Two disjoint auth systems that never overlap at runtime because the deployment is split by env.

**Credential storage.** No database tables. Credentials and employer identity live in environment variables alongside the existing `WHITELABEL_INVOICE_*` config. Justification: a single account with a password set manually by Harrison has no CRUD surface worth a table.

**Session isolation.** A new JWT cookie `whitelabel_session` signed with `WHITELABEL_JWT_SECRET`. The existing `client_session` cookie and `CLIENT_JWT_SECRET` are untouched. Middleware gates `/portal/*` and `/api/portal/*` on `whitelabel_session` when `isWhiteLabel()` returns true, and on `client_session` otherwise.

## New env vars

| var | purpose |
|---|---|
| `WHITELABEL_PORTAL_USERNAME` | shared login username |
| `WHITELABEL_PORTAL_PASSWORD_HASH` | bcrypt hash of the shared password |
| `WHITELABEL_JWT_SECRET` | signing secret for the whitelabel session cookie |
| `WHITELABEL_DEFAULT_AGENT_NAME` | prefills agent name on `/book` when logged into the whitelabel portal |
| `WHITELABEL_DEFAULT_AGENT_EMAIL` | prefills agent email |
| `WHITELABEL_DEFAULT_AGENT_PHONE` | prefills agent phone |

Existing `WHITELABEL_INVOICE_COMPANY` is reused as the company name shown in the portal UI and as the agent company on bookings.

A small seed script helper (one-off, committed under `scripts/`) prints a bcrypt hash for a given password so Harrison can regenerate the env value without running bcrypt inline.

## Pages

All under `/portal/*`. On the main deployment the existing implementations render; on whitelabel these routes render the whitelabel flavor. Branching happens at the server-component or layout level with `isWhiteLabel()`.

- **`/portal/login`** — username + password form. Submits to `/api/portal/login` (existing path — the route detects brand and dispatches to whitelabel auth when on whitelabel). Success sets `whitelabel_session`, redirects to `/portal/dashboard`.

- **`/portal/dashboard`** — welcome line with the employer company name. Three cards: upcoming bookings count, un-invoiced total (pence formatted), date of most recent issued invoice. Links to bookings list, invoices list, and "New Booking".

- **`/portal/bookings`** — all rows from `bookings_whitelabel`, most recent first. Columns: date, address, status, total. No pagination for now (volume is low).

- **`/portal/bookings/new`** — thin redirect to `/book`. No portal-specific form.

  On `/book` under the whitelabel brand with an active `whitelabel_session`, the agent block on the booking form is pre-filled from env vars and **rendered read-only**. Employer staff cannot change the name/email/phone/company on bookings. Without a session the form behaves as before (public whitelabel booking, any staff can book).

- **`/portal/invoices`** — two sections:
  1. Running total of un-invoiced bookings (sum of `bookings_whitelabel.total` where `whitelabelInvoiceId IS NULL`).
  2. Table of past invoices from `whitelabel_invoices`, newest first, with "Download PDF" per row.

- **Sign out** — button in the portal nav posts to `/api/portal/logout` which clears `whitelabel_session`.

## API routes

- **`POST /api/portal/login`** — brand-aware. On whitelabel: compares submitted username to `WHITELABEL_PORTAL_USERNAME` and password against `WHITELABEL_PORTAL_PASSWORD_HASH` (bcrypt). On success, signs a JWT (24h expiry) with `WHITELABEL_JWT_SECRET`, sets `whitelabel_session` cookie (`httpOnly`, `sameSite: "lax"`, `secure` in prod). On main: existing behavior.

- **`POST /api/portal/logout`** — brand-aware; clears whichever session cookie matches the current brand.

- **`GET /api/portal/dashboard`** — on whitelabel, returns `{ companyName, upcomingCount, uninvoicedTotal, lastInvoiceAt }`. On main, existing behavior.

- **`GET /api/portal/bookings`** — on whitelabel, returns all `bookings_whitelabel` rows. On main, existing behavior (per-client filter).

- **`GET /api/portal/invoices`** — on whitelabel, returns `{ uninvoicedTotal, invoices: [...] }` sourced from `whitelabel_invoices`. On main, existing behavior.

- **`GET /api/portal/whitelabel-invoice/[id]/pdf`** — new. Session-gated via middleware. Regenerates and streams the PDF using existing `generateWhitelabelInvoicePdf`. Harrison's admin re-download route (`/api/admin/whitelabel-invoice/[id]/pdf`) stays unchanged and admin-only.

- **Existing `/api/portal/signup*`, `/api/portal/account*` routes** stay untouched — they're main-only and do nothing on whitelabel. Middleware still protects them; they're never invoked on the whitelabel deployment because there's no UI linking to them.

## Middleware

`src/middleware.ts` gains a brand-aware branch for portal paths:

- If `isWhiteLabel()` and path is `/portal/*` or `/api/portal/*`:
  - Public whitelisted paths: `/portal/login`, `/api/portal/login`, `/api/portal/logout`.
  - Otherwise require valid `whitelabel_session` JWT; else redirect/401 as today.
- Else: existing logic against `client_session`.

Main-site portal paths on whitelabel deployment never fire in practice (no UI links), but middleware still blocks them if typed directly.

## Shared auth helper

New file `src/lib/whitelabel-auth.ts`:
- `verifyPassword(submitted: string): Promise<boolean>` — bcrypt compare against env hash.
- `signSession(): Promise<string>` — mint a 24h JWT.
- `verifySession(token: string): Promise<boolean>` — verify signature/exp.

All three are unit-tested with a fake env.

## Book page — read-only agent block

`src/app/book/page.tsx` (server component) reads the `whitelabel_session` cookie. If `isWhiteLabel()` and the cookie is valid, it passes a `lockedAgent: { name, email, phone, company }` prop (values from env vars) down to the client `BookingSection` component. When present, `BookingSection` renders the agent fields with those values and `disabled`/`readOnly` styling, and the submission payload uses the locked values. When the prop is absent, agent fields behave as today.

The `/api/whitelabel-prefill` endpoint is therefore **not needed** — remove from scope.

No logic change on the main site.

## Out of scope

- Password reset / change password flow (Harrison rotates the env hash manually; infrequent).
- Per-user accounts within the employer (explicitly rejected during brainstorming).
- Notification emails to the employer from the portal (public booking flow handles email; portal-submitted bookings use the same path).
- Any change to the main-site portal.
- Mobile layout tweaks beyond what existing portal styles already provide.
