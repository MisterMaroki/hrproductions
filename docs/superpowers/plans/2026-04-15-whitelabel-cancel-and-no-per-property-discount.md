# Whitelabel portal: cancel shoot + remove per-property discount — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let whitelabel portal clients cancel their own bookings (when `pending` or `confirmed`), and stop showing the multi-property discount on the whitelabel basket.

**Architecture:** One new API route (`POST /api/portal/bookings/[id]/cancel`) with a cancel button on the whitelabel portal bookings list. One conditional in `Basket.tsx` to skip the multi-property discount on whitelabel.

**Tech Stack:** Next.js App Router, Drizzle ORM (SQLite), existing `getWhitelabelSession()` auth helper, `isWhiteLabel()` brand helper.

**Spec:** `docs/superpowers/specs/2026-04-15-whitelabel-cancel-and-no-per-property-discount-design.md`

**Testing:** Manual only (matches existing whitelabel portal conventions). No automated test suite runs against this feature.

---

## Task 1: Cancel API route

**Files:**
- Create: `src/app/api/portal/bookings/[id]/cancel/route.ts`

**Context for implementer:**
- Whitelabel is single-tenant — a valid whitelabel session implies ownership of every whitelabel booking. The existing `GET /api/portal/bookings` uses this same model (returns all `bookingsWhitelabel` rows to any authenticated session).
- The route should 404 (or similar) on the main-app (non-whitelabel) side — cancel is whitelabel-only for this iteration.
- `bookings_whitelabel` has NO `updatedAt` column — only update `status`.

- [ ] **Step 1: Create the cancel route**

Create `src/app/api/portal/bookings/[id]/cancel/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

const CANCELLABLE_STATUSES = new Set(["pending", "confirmed"]);

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isWhiteLabel()) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const session = await getWhitelabelSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rows = await db
    .select()
    .from(bookingsWhitelabel)
    .where(eq(bookingsWhitelabel.id, id))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const booking = rows[0];

  if (!CANCELLABLE_STATUSES.has(booking.status)) {
    return NextResponse.json(
      { error: `Cannot cancel a booking with status "${booking.status}"` },
      { status: 409 }
    );
  }

  await db
    .update(bookingsWhitelabel)
    .set({ status: "cancelled" })
    .where(eq(bookingsWhitelabel.id, id));

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `pnpm tsc --noEmit` (or whatever the repo uses — check `package.json` if unsure, common options: `npm run typecheck`, `pnpm lint`).
Expected: no new TypeScript errors in this file.

- [ ] **Step 3: Smoke-test the route manually against dev**

Run the whitelabel dev server (however this repo starts the whitelabel variant — check `package.json` scripts, likely something like `pnpm dev:whitelabel` or an env flag; if unclear, ask the user once).

With a logged-in whitelabel portal session (use the browser), in the devtools console run:

```js
await fetch("/api/portal/bookings/NON_EXISTENT_ID/cancel", { method: "POST" }).then(r => r.status);
```

Expected: `404`.

Then pick a real whitelabel booking id with status `confirmed` from the bookings list page and POST to its cancel endpoint. Expected: `200`, and reloading the bookings list shows it as `cancelled`.

Pick a booking already set to `invoiced` (or manually flip one in the DB to test), POST to its cancel endpoint. Expected: `409`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/bookings/[id]/cancel/route.ts
git commit -m "feat(whitelabel-portal): cancel shoot API (pending/confirmed only)"
```

---

## Task 2: Cancel button on portal bookings list

**Files:**
- Modify: `src/app/portal/bookings/page.tsx`

**Context for implementer:**
- The existing page is a client component; bookings are fetched once on mount. After cancel, re-fetch the list so the row's status + the tab counts update.
- Show the Cancel button only when `whitelabel === true` AND `status === 'pending' || 'confirmed'`.
- Use `window.confirm` — the rest of the codebase uses `alert()` for feedback (see `Basket.tsx` line 83), matching that simple style is fine. No new toast library.

- [ ] **Step 1: Factor the fetch so it can run on mount and after cancel**

In `src/app/portal/bookings/page.tsx`, replace the current `useEffect` block (lines 74–78) with:

```tsx
  const loadBookings = async () => {
    setLoading(true);
    const r = await fetch("/api/portal/bookings");
    const d = await r.json();
    setBookings(d);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, []);
```

- [ ] **Step 2: Add the cancel handler**

Add this inside the component, after `loadBookings`:

```tsx
  const handleCancel = async (id: string) => {
    if (!window.confirm("Cancel this shoot? This can't be undone.")) return;
    const r = await fetch(`/api/portal/bookings/${id}/cancel`, { method: "POST" });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      alert(data.error || "Failed to cancel booking");
      return;
    }
    await loadBookings();
  };
```

- [ ] **Step 3: Render the cancel button on eligible rows**

Inside the `filtered.map((b) => { ... })` block, immediately after the `<div className={styles.cardServices}>` line (currently line 137), add:

```tsx
                    {whitelabel && (b.status === "pending" || b.status === "confirmed") && (
                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.cancelBtn}
                          onClick={() => handleCancel(b.id)}
                        >
                          Cancel shoot
                        </button>
                      </div>
                    )}
```

- [ ] **Step 4: Add matching CSS for the action row**

Open `src/app/portal/bookings/page.module.css`. Append:

```css
.cardActions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.cancelBtn {
  background: transparent;
  border: 1px solid #d0d0d0;
  color: #a33;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
}

.cancelBtn:hover {
  background: #fbecec;
  border-color: #c88;
}
```

(If the existing file uses different naming/colour conventions — e.g. CSS variables, different hex shades — match those instead. Check the top of `page.module.css` before adding.)

- [ ] **Step 5: Typecheck**

Run: `pnpm tsc --noEmit` (or the repo equivalent).
Expected: no new TypeScript errors.

- [ ] **Step 6: Manual test — happy path**

Start the whitelabel dev server, log in to the portal, navigate to `/portal/bookings`.

- A `confirmed` booking shows a "Cancel shoot" button. Click it, confirm the dialog. The row's status flips to `Cancelled`, the Cancelled tab count goes up by 1, the Confirmed count goes down by 1.
- An `invoiced` or `paid` booking shows NO cancel button.

- [ ] **Step 7: Manual test — error path**

With devtools Network tab open, cancel a booking while simultaneously flipping it in the DB to `invoiced`. Expected: alert appears with the server's 409 message, list reloads and shows the booking as `invoiced` (not `cancelled`).

(If reproducing the race is fiddly, skip to verifying the 409 path works by temporarily changing the button's condition to include `invoiced`, attempting cancel, seeing the alert, then reverting the condition.)

- [ ] **Step 8: Commit**

```bash
git add src/app/portal/bookings/page.tsx src/app/portal/bookings/page.module.css
git commit -m "feat(whitelabel-portal): cancel shoot button for pending/confirmed bookings"
```

---

## Task 3: Remove multi-property discount on whitelabel basket

**Files:**
- Modify: `src/components/Basket.tsx`

**Context for implementer:**
- The main-app (non-whitelabel) flow MUST continue to show and apply the multi-property discount exactly as before.
- `calcMultiPropertyDiscount` stays in `pricing-engine.ts` — other call sites still use it.
- After this change, the whitelabel display total matches what `POST /api/whitelabel/book` actually writes (which already ignores multi-property discount). No other server changes needed.

- [ ] **Step 1: Skip the multi-property discount on whitelabel**

In `src/components/Basket.tsx` line 57, change:

```tsx
  const discount = calcMultiPropertyDiscount(properties.length);
```

to:

```tsx
  const discount = isWhiteLabel() ? 0 : calcMultiPropertyDiscount(properties.length);
```

No other logic changes needed — `grandTotal` and `codeDiscountAmount` already use the `discount` variable, so setting it to 0 cascades correctly. The `{discount > 0 && ...}` block at line 185 that renders the "Multi-property discount" line will also disappear automatically.

- [ ] **Step 2: Typecheck**

Run: `pnpm tsc --noEmit` (or the repo equivalent).
Expected: no new TypeScript errors.

- [ ] **Step 3: Manual test — whitelabel**

Start the whitelabel dev server. Go to the booking flow, add two properties with the same shoot services. In the basket:

- The "Multi-property discount (2 properties)" line does NOT appear.
- `grandTotal` equals the sum of the two property subtotals (minus any discount code, if applied).
- Submit the booking. On the portal bookings list, the resulting invoice/booking total matches what the basket showed.

- [ ] **Step 4: Manual test — main app (regression)**

Start the main-app dev server (non-whitelabel mode). Go to the booking flow, add two properties. In the basket:

- The "Multi-property discount (2 properties)" line appears with `-£15.00`.
- `grandTotal` = sum of subtotals − £15 (− any code discount).
- Proceeding to checkout reflects the discounted total (as before).

- [ ] **Step 5: Commit**

```bash
git add src/components/Basket.tsx
git commit -m "feat(whitelabel): remove multi-property discount on whitelabel basket"
```

---

## Task 4: End-to-end verification

**Files:** none

- [ ] **Step 1: Full whitelabel flow**

Log into whitelabel portal, create two new bookings (different properties, same date). Confirm:
- Basket total = sum of the two; no multi-property discount line.
- Both bookings land in the list with status `confirmed`.
- Cancel one. Its status flips to `cancelled`; the other remains `confirmed`.
- Try cancelling the `cancelled` one via the browser console (`fetch("/api/portal/bookings/<id>/cancel", { method: "POST" })`). Response: 409.

- [ ] **Step 2: Full main-app regression**

Log into main-app portal as an existing client, book two properties. Confirm:
- Multi-property discount line still appears (`-£15`).
- Checkout total matches basket grand total.
- No cancel button appears on main-app bookings (whitelabel-only feature).

- [ ] **Step 3: Tell the user the work is done**

Report back: what was built, what was tested, any surprises. Do NOT claim success without having actually run both manual flows.
