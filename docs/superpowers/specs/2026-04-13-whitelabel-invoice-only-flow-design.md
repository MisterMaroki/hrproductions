# Whitelabel Invoice-Only Booking Flow

## Goal

On the whitelabel deployment, remove all payment (Stripe) and trade-account (GoCardless) flows. Bookings are submitted directly, accumulate un-invoiced, and Harrison generates a single consolidated PDF invoice on demand to send to his employer manually.

## Why

Harrison's current employer books shoots via the whitelabel site. It is a single invoiced counterparty, not a general customer — no payment collection, no account provisioning, no Direct Debit setup is needed. Harrison just needs to bill them periodically.

## Scope

**Isolation principle:** whitelabel data lives in dedicated tables so main-site admin/client queries are unaffected. No new `brand` columns on existing tables.

### New tables

**`bookings_whitelabel`** — mirror of `bookings` minus payment fields, plus invoice linkage.

| column | type | notes |
|---|---|---|
| id | text pk | |
| address, postcode, bedrooms, preferredDate, startTime, endTime, notes | | same as `bookings` |
| agentName, agentCompany, agentEmail, agentPhone | | same |
| services (json), workHours, subtotal, discountCode, discountAmount, total | | same |
| status | text, default `"confirmed"` | no `pending` — there's no payment to await |
| whitelabelInvoiceId | text, nullable | FK to `whitelabel_invoices.id` when invoiced |
| createdAt | | |

No `stripeSession`, no `clientId`.

**`whitelabel_invoices`** — one row per generated PDF.

| column | type | notes |
|---|---|---|
| id | text pk | |
| invoiceNumber | text unique | e.g. `WL-0001` (monotonic) |
| totalAmount | integer (pence) | sum of linked bookings' totals |
| bookingCount | integer | |
| pdfPath | text, nullable | if we persist PDFs; else generated on download |
| generatedAt | text | |

No send/delivery fields — Harrison sends manually.

### Unchanged tables

`blocked_days` and `discount_codes` are shared with main site. `clients`, `invoices`, `invoice_items`, `services*`, `gallery_*` are untouched.

## Booking submission (whitelabel)

**UI — `Basket.tsx`:** when `isWhiteLabel()`:
- Skip the `choose` / `pay` / `account` modes entirely.
- Render a single button "Submit Booking" in place of "Proceed to Payment".
- On click → `POST /api/whitelabel/book` with the same payload shape as `/api/checkout`.
- On success → show the existing account-success–style confirmation block (reuse styles): check icon, "Booking Confirmed" heading, short message.

**API — `POST /api/whitelabel/book`:**
- Reuses `buildLineItems`-equivalent logic (extract shared helper from `checkout/route.ts` into `src/lib/booking-calc.ts`) to compute per-property `services`, `workHours`, `subtotal`, `discountAmount`, `total`.
- Inserts one row per property into `bookings_whitelabel` with `status="confirmed"`, `whitelabelInvoiceId=null`.
- Returns `{ ok: true }`. No Stripe, no email, no PDF at this stage.

**Discount codes:** keep the field active — discount applies to booking totals as usual, flows into the eventual invoice.

## Admin — whitelabel invoicing

**New page: `/admin/whitelabel-invoice`**

Gated by existing admin auth. Two sections:

1. **Un-invoiced bookings** — table of all `bookings_whitelabel` rows where `whitelabelInvoiceId IS NULL`, showing date, address, agent name, services summary, total. Running cumulative total at the bottom.
2. **Generate invoice** — single button "Generate Invoice PDF". On click:
   - Creates a `whitelabel_invoices` row with next sequential `invoiceNumber`, `totalAmount` = sum, `bookingCount` = count.
   - Updates all selected bookings to set `whitelabelInvoiceId`.
   - Generates PDF (reusing the `account-invoice-pdf.ts` template, adapted) with bill-to block populated from env vars.
   - Returns the PDF as a download.

Harrison emails the PDF himself from his own client — no send action in the app.

**Past invoices list** on the same page: shows each `whitelabel_invoices` row with date, invoice number, total, booking count, and a "Re-download PDF" link (re-generates on demand from stored bookings).

### Bill-to config (env vars)

- `WHITELABEL_INVOICE_COMPANY` — e.g. "Example Estate Agents Ltd"
- `WHITELABEL_INVOICE_ADDRESS_LINES` — newline-separated (or `\n`-escaped) address block
- `WHITELABEL_INVOICE_EMAIL` — optional, shown on invoice

"From" block on the invoice uses Harrison's business details, same as the existing `account-invoice-pdf` invoices.

## File changes

**New:**
- `src/app/api/whitelabel/book/route.ts`
- `src/app/admin/whitelabel-invoice/page.tsx`
- `src/app/api/admin/whitelabel-invoice/generate/route.ts`
- `src/app/api/admin/whitelabel-invoice/[id]/pdf/route.ts` (re-download)
- `src/lib/whitelabel-invoice-pdf.ts` (adapted from `account-invoice-pdf.ts`)
- `src/lib/booking-calc.ts` (shared helper extracted from `checkout/route.ts`)
- Drizzle migration adding the two new tables

**Modified:**
- `src/lib/schema.ts` — add `bookingsWhitelabel`, `whitelabelInvoices`
- `src/components/Basket.tsx` — whitelabel branch: single "Submit Booking" button; reuse success block
- `src/app/api/checkout/route.ts` — refactor extraction only, no behavior change
- Admin nav — add "Whitelabel Invoice" link, gated so it's only obviously useful on the whitelabel deployment (link shown unconditionally in admin; the page works regardless of brand)

## Out of scope

- Automated monthly generation
- Email delivery of invoice
- Whitelabel-specific admin booking list (Harrison views upcoming whitelabel shoots via the existing admin bookings page — it will need a query update to also read from `bookings_whitelabel` for the calendar view; flagged but not detailed here, to be handled when writing the plan)
- Any change to main-site payment/account flows
