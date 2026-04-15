# Whitelabel portal: cancel shoot + remove per-property discount

**Date:** 2026-04-15
**Status:** Approved for implementation
**Follows:** `2026-04-13-whitelabel-invoice-only-flow-design.md`

## Background

Two follow-up changes requested after the whitelabel portal went live:

1. Clients frequently postpone or cancel shoots. The whitelabel portal currently has no cancel action — Harrison has to cancel manually in admin.
2. The basket displays the multi-property discount (£15 per extra property) on the whitelabel path. Whitelabel pricing is already heavily reduced; Harrison does not want this additional discount applied for whitelabel clients. The main property-room app must keep the discount unchanged.

Secondary: the whitelabel basket currently *shows* the multi-property discount but `POST /api/whitelabel/book` does not apply it when writing the booking/invoice totals. Removing the discount from the whitelabel basket also eliminates this display/invoice drift.

## Scope

In scope:

- Portal-side cancel action for a whitelabel client's own bookings.
- Removal of the multi-property discount from the whitelabel basket flow only.

Out of scope:

- Any changes to main-app (property-room) pricing.
- Cancelling bookings that have been invoiced or paid (Harrison handles those manually in admin).
- Reason capture, admin notifications, refund logic.
- Schema migrations — none needed.

## Design

### 1. Cancel shoot from whitelabel portal

**Allowed states.** Cancel is permitted only when `bookings_whitelabel.status` is `pending` or `confirmed`. New whitelabel bookings default to `confirmed`; `pending` is included for safety in case that ever changes. Any other status (`completed`, `invoiced`, `paid`, `cancelled`) renders no cancel control and the API rejects the request.

**API.** New route: `POST /api/portal/bookings/[id]/cancel`.

- Auth: reuse the existing portal session check used by `GET /api/portal/bookings`.
- Ownership: look up `bookings_whitelabel` by id and confirm the record belongs to the logged-in whitelabel user (same user/brand scoping as the list endpoint).
- Guard: if `status` is not `pending` or `confirmed`, respond `409 Conflict` with a short error body; do not mutate.
- Mutation: `UPDATE bookings_whitelabel SET status = 'cancelled', updatedAt = now() WHERE id = ?`.
- Response: `200` with the updated booking (or `{ ok: true }` is acceptable — UI just refetches the list).

No invoice mutation. Because cancellation is blocked once a booking is invoiced, `whitelabel_invoices` totals are never affected by this flow.

**UI.** In `src/app/portal/bookings/page.tsx`:

- Render a "Cancel" button on each booking row when `status === 'pending' || status === 'confirmed'`.
- On click, show a native `confirm()` dialog ("Cancel this shoot? This can't be undone.").
- On confirm, `POST` to the cancel endpoint, show a toast on success/error, and refetch the bookings list so the status filter tabs and row state update.
- No new styling system — reuse existing button styling from the portal pages.

**Admin visibility.** No admin changes required. The existing admin bookings list already surfaces `cancelled` status.

### 2. Remove per-property discount on whitelabel

**Single change.** In `src/components/Basket.tsx` (~line 57, where `calcMultiPropertyDiscount` is called), skip both the calculation and the corresponding discount line in the totals when `isWhiteLabel()` is true. The main-app code path is untouched.

**API.** No change. `src/app/api/whitelabel/book/route.ts` does not call `calcMultiPropertyDiscount()`, so the booking row and invoice total already exclude it. After the basket change, the displayed total will match the booked total.

**Pricing engine.** `calcMultiPropertyDiscount` in `src/lib/pricing-engine.ts` stays as-is — still used by the main-app checkout path.

## Testing

Manual verification only (matches the rest of the whitelabel portal work):

- Whitelabel basket: add a shoot for two different properties → total equals the full sum, no multi-property discount line appears.
- Main-app basket: add the same two properties → the £15 multi-property discount line still appears and is deducted.
- Whitelabel portal bookings list:
  - Booking with status `pending` or `confirmed` shows a Cancel button; clicking and confirming flips status to `cancelled`, row moves to the Cancelled tab, admin list shows the same status.
  - Booking with status `completed`, `invoiced`, `paid`, or `cancelled` shows no Cancel button.
  - Hitting the cancel endpoint directly for a non-cancellable booking returns 409.
  - Hitting the cancel endpoint for a booking owned by a different whitelabel user is rejected by the ownership check.

## Files touched

- `src/app/api/portal/bookings/[id]/cancel/route.ts` — new.
- `src/app/portal/bookings/page.tsx` — add cancel button + handler.
- `src/components/Basket.tsx` — skip multi-property discount when `isWhiteLabel()`.
