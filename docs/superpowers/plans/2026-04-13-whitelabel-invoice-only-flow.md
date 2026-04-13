# Whitelabel Invoice-Only Booking Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the whitelabel deployment, remove Stripe/GoCardless flows entirely. Bookings go straight into a dedicated `bookings_whitelabel` table with status `confirmed`. Harrison uses a new admin page to generate a single consolidated PDF invoice covering un-invoiced bookings, then sends it manually.

**Architecture:** Dedicated `bookings_whitelabel` and `whitelabel_invoices` tables — no `brand` columns on existing tables. Shared pricing/duration calculation extracted from `checkout/route.ts` into `src/lib/booking-calc.ts`. Reuses existing `isWhiteLabel()` flag in `Basket.tsx` for branching. Reuses `pdf-lib` layout idioms from `account-invoice-pdf.ts` for a new `whitelabel-invoice-pdf.ts`.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle ORM (libsql/sqlite) · pdf-lib · Jest (ts-jest). Dev server for this flow: `NEXT_PUBLIC_BRAND_MODE=whitelabel BRAND_MODE=whitelabel npm run dev -- --port 3100`.

**File structure:**

- **New**
  - `src/lib/booking-calc.ts` — shared computation: per-property services snapshot, workHours, subtotal, total
  - `src/lib/whitelabel-invoice-pdf.ts` — PDF generator, bill-to from env vars
  - `src/app/api/whitelabel/book/route.ts` — public POST endpoint for whitelabel bookings
  - `src/app/admin/whitelabel-invoice/page.tsx` — admin list + generate UI
  - `src/app/admin/whitelabel-invoice/page.module.css`
  - `src/app/api/admin/whitelabel-invoice/route.ts` — GET list of un-invoiced + past invoices
  - `src/app/api/admin/whitelabel-invoice/generate/route.ts` — POST generate
  - `src/app/api/admin/whitelabel-invoice/[id]/pdf/route.ts` — GET re-download
  - `drizzle/0004_whitelabel_tables.sql` — migration (filename may vary after `db:generate`)
  - `src/lib/__tests__/booking-calc.test.ts`
- **Modified**
  - `src/lib/schema.ts` — add `bookingsWhitelabel`, `whitelabelInvoices`
  - `src/app/api/checkout/route.ts` — delete duplicated calc helpers, import from `booking-calc`
  - `src/components/Basket.tsx` — whitelabel branch: single "Submit Booking" button + success block
  - `src/app/admin/components/AdminNav.tsx` — add "Whitelabel" link

---

## Task 1: Add whitelabel tables to schema

**Files:**
- Modify: `src/lib/schema.ts` (append at end)
- Test: `src/lib/__tests__/schema.test.ts` (verify tables are exported)

- [ ] **Step 1: Add tables to schema**

Append to `src/lib/schema.ts`:

```ts
export const bookingsWhitelabel = sqliteTable("bookings_whitelabel", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  postcode: text("postcode"),
  bedrooms: integer("bedrooms").notNull(),
  preferredDate: text("preferred_date").notNull(),
  startTime: text("start_time"),
  endTime: text("end_time"),
  notes: text("notes"),
  agentName: text("agent_name").notNull(),
  agentCompany: text("agent_company"),
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  services: text("services").notNull(),
  workHours: real("work_hours").notNull(),
  subtotal: integer("subtotal").notNull(),
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("confirmed"),
  whitelabelInvoiceId: text("whitelabel_invoice_id"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const whitelabelInvoices = sqliteTable("whitelabel_invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  totalAmount: integer("total_amount").notNull(),
  bookingCount: integer("booking_count").notNull(),
  generatedAt: text("generated_at").default(sql`CURRENT_TIMESTAMP`),
});
```

- [ ] **Step 2: Verify schema test passes**

Look at existing `src/lib/__tests__/schema.test.ts` — it likely checks existing exports. If it enumerates exports, add `bookingsWhitelabel` and `whitelabelInvoices` assertions. If it doesn't touch this, no change needed.

Run: `npx jest schema.test.ts`
Expected: PASS

- [ ] **Step 3: Generate and apply migration**

Run: `npm run db:generate`
Expected: new migration file under `drizzle/` (e.g. `0004_*.sql`) creating both tables.

Inspect the generated file — should contain `CREATE TABLE bookings_whitelabel` and `CREATE TABLE whitelabel_invoices`. If anything else is included (unrelated drift), abort and investigate.

Run: `npm run db:migrate`
Expected: migration applies without error.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat(whitelabel): add bookings_whitelabel and whitelabel_invoices tables"
```

---

## Task 2: Extract shared booking calc helper

**Files:**
- Create: `src/lib/booking-calc.ts`
- Create: `src/lib/__tests__/booking-calc.test.ts`
- Modify: `src/app/api/checkout/route.ts` (remove duplicated logic)

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/booking-calc.test.ts`:

```ts
import { computeBookingRow, type ServiceSnapshot } from "../booking-calc";

const svc: ServiceSnapshot = {
  id: "svc1",
  name: "Photography",
  pricingRules: { basePrice: 100, rules: [] },
  durationRules: { baseMinutes: 60 },
};

describe("computeBookingRow", () => {
  it("computes subtotal, total, workHours for a single-service property", () => {
    const row = computeBookingRow(
      {
        id: "p1",
        address: "1 High St",
        postcode: "BN1 1AA",
        bedrooms: 3,
        preferredDate: "2026-05-01",
        timeSlot: "09:00",
        notes: "",
        selectedServices: [{ serviceId: "svc1", inputs: {} }],
      },
      [svc],
      0,
    );

    expect(row.subtotal).toBe(10000); // pence
    expect(row.total).toBe(10000);
    expect(row.workHours).toBe(1);
    expect(row.startTime).toBe("09:00");
    expect(row.endTime).toBe("10:00");
    const parsed = JSON.parse(row.services);
    expect(parsed[0].serviceName).toBe("Photography");
  });

  it("applies per-property discount percentage", () => {
    const row = computeBookingRow(
      {
        id: "p1",
        address: "1 High St",
        postcode: null,
        bedrooms: 2,
        preferredDate: "2026-05-01",
        timeSlot: null,
        notes: "",
        selectedServices: [{ serviceId: "svc1", inputs: {} }],
      },
      [svc],
      10,
    );

    expect(row.subtotal).toBe(10000);
    expect(row.discountAmount).toBe(1000);
    expect(row.total).toBe(9000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest booking-calc.test.ts`
Expected: FAIL — cannot resolve module `../booking-calc`.

- [ ] **Step 3: Implement `booking-calc.ts`**

Create `src/lib/booking-calc.ts`:

```ts
import { evaluatePrice, evaluateDuration, type PricingRules } from "@/lib/pricing-engine";

export interface ServiceSnapshot {
  id: string;
  name: string;
  pricingRules: PricingRules;
  durationRules: unknown;
}

export interface PropertyInput {
  id: string;
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string | null;
  notes: string;
  selectedServices: { serviceId: string; inputs: Record<string, number | string | boolean> }[];
}

export interface BookingRow {
  services: string; // JSON: SelectedService[]
  workHours: number;
  subtotal: number; // pence
  discountAmount: number; // pence
  total: number; // pence
  startTime: string | null;
  endTime: string | null;
}

export function computeBookingRow(
  p: PropertyInput,
  allServices: ServiceSnapshot[],
  discountPct: number,
): BookingRow {
  const servicesData = p.selectedServices.map((sel) => {
    const svc = allServices.find((s) => s.id === sel.serviceId);
    return {
      serviceId: sel.serviceId,
      serviceName: svc?.name ?? "Unknown",
      inputs: sel.inputs,
      computedPrice: svc
        ? evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms }).total
        : 0,
    };
  });

  const workMinutes = p.selectedServices.reduce((total, sel) => {
    const svc = allServices.find((s) => s.id === sel.serviceId);
    if (!svc) return total;
    return total + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: p.bedrooms });
  }, 0);
  const workHours = Math.round((workMinutes / 60) * 100) / 100;

  const subtotal = Math.round(
    servicesData.reduce((sum, s) => sum + s.computedPrice, 0) * 100,
  );
  const discountAmount = discountPct ? Math.round(subtotal * (discountPct / 100)) : 0;
  const total = subtotal - discountAmount;

  let startTime: string | null = p.timeSlot || null;
  let endTime: string | null = null;
  if (startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const endMins = h * 60 + m + Math.round(workHours * 60);
    const endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
  }

  return {
    services: JSON.stringify(servicesData),
    workHours,
    subtotal,
    discountAmount,
    total,
    startTime,
    endTime,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest booking-calc.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Refactor `checkout/route.ts` to use the helper**

In `src/app/api/checkout/route.ts`, replace the inline per-property computation in the `for (const p of properties)` block that builds the `bookings` insert (currently lines ~220-280) with a single call:

```ts
const row = computeBookingRow(
  {
    id: p.id,
    address: p.address,
    postcode: p.postcode || null,
    bedrooms: p.bedrooms,
    preferredDate: p.preferredDate,
    timeSlot: p.timeSlot || null,
    notes: p.notes,
    selectedServices: p.selectedServices,
  },
  allServices,
  discountPct,
);

await db.insert(bookings).values({
  id: crypto.randomUUID(),
  address: p.address,
  postcode: p.postcode || null,
  bedrooms: p.bedrooms,
  preferredDate: p.preferredDate,
  startTime: row.startTime,
  endTime: row.endTime,
  notes: p.notes || null,
  agentName: agent.name,
  agentCompany: agent.company || null,
  agentEmail: agent.email,
  agentPhone: agent.phone || null,
  services: row.services,
  workHours: row.workHours,
  subtotal: row.subtotal,
  discountCode: discountCode || null,
  discountAmount: row.discountAmount,
  total: row.total,
  stripeSession: session.id,
  status: "pending",
});
```

Add `import { computeBookingRow } from "@/lib/booking-calc";` at the top. Keep `buildLineItems` and `calcTotalDiscountPence` as-is — they're Stripe-specific. Remove the now-unused `workHours` and `subtotal` inline computations.

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/booking-calc.ts src/lib/__tests__/booking-calc.test.ts src/app/api/checkout/route.ts
git commit -m "refactor: extract shared computeBookingRow helper"
```

---

## Task 3: Whitelabel booking API route

**Files:**
- Create: `src/app/api/whitelabel/book/route.ts`

- [ ] **Step 1: Implement the route**

Create `src/app/api/whitelabel/book/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel } from "@/lib/schema";
import { computeBookingRow } from "@/lib/booking-calc";
import { getServicesForBrand } from "@/lib/services";

interface SelectedServicePayload {
  serviceId: string;
  inputs: Record<string, number | string | boolean>;
}

interface PropertyPayload {
  id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string;
  notes: string;
  selectedServices: SelectedServicePayload[];
}

interface Body {
  properties: PropertyPayload[];
  agent: { name: string; company: string; email: string; phone: string };
  discountCode?: string;
  discountPercentage?: number;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();
    const { properties, agent, discountCode, discountPercentage } = body;

    if (!properties?.length) {
      return NextResponse.json({ error: "No properties provided" }, { status: 400 });
    }
    if (!agent?.email || !agent?.name) {
      return NextResponse.json({ error: "Agent details required" }, { status: 400 });
    }

    const categories = await getServicesForBrand("whitelabel");
    const allServices = categories.flatMap((c) => c.services);
    const discountPct = discountPercentage || 0;

    const insertedIds: string[] = [];
    for (const p of properties) {
      const row = computeBookingRow(
        {
          id: p.id,
          address: p.address,
          postcode: p.postcode || null,
          bedrooms: p.bedrooms,
          preferredDate: p.preferredDate,
          timeSlot: p.timeSlot || null,
          notes: p.notes || "",
          selectedServices: p.selectedServices,
        },
        allServices,
        discountPct,
      );

      const id = crypto.randomUUID();
      await db.insert(bookingsWhitelabel).values({
        id,
        address: p.address,
        postcode: p.postcode || null,
        bedrooms: p.bedrooms,
        preferredDate: p.preferredDate,
        startTime: row.startTime,
        endTime: row.endTime,
        notes: p.notes || null,
        agentName: agent.name,
        agentCompany: agent.company || null,
        agentEmail: agent.email,
        agentPhone: agent.phone || null,
        services: row.services,
        workHours: row.workHours,
        subtotal: row.subtotal,
        discountCode: discountCode || null,
        discountAmount: row.discountAmount,
        total: row.total,
        status: "confirmed",
      });
      insertedIds.push(id);
    }

    return NextResponse.json({ ok: true, bookingIds: insertedIds });
  } catch (err) {
    console.error("Whitelabel booking error:", err);
    return NextResponse.json({ error: "Failed to submit booking" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/whitelabel/book/route.ts
git commit -m "feat(whitelabel): add /api/whitelabel/book endpoint"
```

---

## Task 4: Update Basket UI for whitelabel

**Files:**
- Modify: `src/components/Basket.tsx`

- [ ] **Step 1: Rewire Basket to branch by brand**

In `src/components/Basket.tsx`:

1. Change the `mode` initializer: when `isWhiteLabel()`, start at a new mode `"whitelabel"` instead of `"pay"`. Add `"whitelabel"` to the `CheckoutMode` union.

   ```ts
   type CheckoutMode = "choose" | "pay" | "account" | "whitelabel";
   // ...
   const [mode, setMode] = useState<CheckoutMode>(isWhiteLabel() ? "whitelabel" : "choose");
   ```

2. Add a new handler `handleWhitelabelSubmit` modeled on `handleAccountSignup` but posting to `/api/whitelabel/book`:

   ```ts
   const [wlSuccess, setWlSuccess] = useState(false);

   const handleWhitelabelSubmit = useCallback(async () => {
     if (!onValidate()) return;
     setLoading(true);
     try {
       const res = await fetch("/api/whitelabel/book", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ properties, agent, discountCode, discountPercentage }),
       });
       const data = await res.json();
       if (!res.ok) {
         throw new Error(data.error || "Submission failed");
       }
       setWlSuccess(true);
     } catch (err) {
       console.error("Whitelabel booking error:", err);
       alert("Something went wrong. Please try again.");
     } finally {
       setLoading(false);
     }
   }, [properties, agent, discountCode, discountPercentage, onValidate]);
   ```

3. Replace the existing success/mode branching with whitelabel-first handling. The structure becomes:

   ```tsx
   {wlSuccess ? (
     <div className={styles.accountSuccess}>
       <div className={styles.accountSuccessIcon}>
         <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#0a0a0a"/><path d="M10 16.5L14 20.5L22 12.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/></svg>
       </div>
       <h4 className={styles.accountSuccessTitle}>Booking Confirmed</h4>
       <p className={styles.accountSuccessText}>
         Thanks {agent.name}. We&apos;ve received your booking. You&apos;ll get a confirmation email at <strong>{agent.email}</strong>.
       </p>
     </div>
   ) : mode === "whitelabel" ? (
     <button
       className={styles.checkout}
       onClick={handleWhitelabelSubmit}
       disabled={!hasItems || loading}
     >
       {loading ? "Submitting..." : "Submit Booking"}
     </button>
   ) : accountSuccess ? (
     /* existing accountSuccess block unchanged */
   ) : mode === "account" ? (
     /* existing account form block unchanged */
   ) : mode === "pay" ? (
     /* existing pay block unchanged */
   ) : (
     /* existing choose block unchanged */
   )}
   ```

4. Remove the dead `{!isWhiteLabel() && ...}` guard inside the old `"pay"` branch's back button — whitelabel no longer enters `"pay"` mode, so the condition simplifies to always-render.

- [ ] **Step 2: Manually verify in browser**

Ensure dev server is running: `NEXT_PUBLIC_BRAND_MODE=whitelabel BRAND_MODE=whitelabel npm run dev -- --port 3100`.

Visit `http://localhost:3100/book`. Fill in property + agent details. Confirm:
- Basket shows only a "Submit Booking" button (no "Pay Now", no account option).
- Clicking it posts and shows the "Booking Confirmed" block.
- A row appears in `bookings_whitelabel` (check via `npm run db:studio` or equivalent).
- No `bookings` row is created.

Also visit `http://localhost:3000/book` on a separately-run main dev server (or just flip env temporarily) and confirm the pay/account flow is unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/components/Basket.tsx
git commit -m "feat(whitelabel): single Submit Booking button in Basket"
```

---

## Task 5: Whitelabel invoice PDF generator

**Files:**
- Create: `src/lib/whitelabel-invoice-pdf.ts`

- [ ] **Step 1: Implement the generator**

Create `src/lib/whitelabel-invoice-pdf.ts`. Copy the structure from `src/lib/account-invoice-pdf.ts` and adapt:

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

export interface WhitelabelInvoiceData {
  invoiceNumber: string;
  generatedAt: string; // ISO
  billTo: {
    company: string;
    addressLines: string[];
    email?: string;
  };
  bookings: Array<{
    address: string;
    postcode: string | null;
    bedrooms: number;
    preferredDate: string;
    startTime: string | null;
    endTime: string | null;
    services: string; // JSON
    total: number; // pence
  }>;
  totalAmount: number; // pence
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function parseServiceNames(servicesJson: string): string[] {
  try {
    const parsed = JSON.parse(servicesJson);
    if (Array.isArray(parsed)) {
      return parsed.map((s: { serviceName?: string; serviceId?: string }) => s.serviceName || s.serviceId || "Service");
    }
  } catch {}
  return [];
}

export async function generateWhitelabelInvoicePdf(data: WhitelabelInvoiceData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const ml = 50;
  const mr = 50;
  const cw = pageWidth - ml - mr;

  const black = rgb(0.04, 0.04, 0.04);
  const muted = rgb(0.54, 0.52, 0.5);
  const white = rgb(1, 1, 1);

  function addPage() {
    const pg = doc.addPage([pageWidth, pageHeight]);
    return { pg, y: pageHeight - 50 };
  }

  let { pg: page, y } = addPage();

  // No logo — this is a plain invoice to Harrison's employer, no TPR branding.
  // Title
  page.drawText("INVOICE", { x: ml, y: pageHeight - 60, size: 22, font: bold, color: black });

  const invoiceDate = new Date(data.generatedAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  y = pageHeight - 90;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  // Meta
  for (const item of [
    { label: "INVOICE NO.", value: data.invoiceNumber },
    { label: "DATE", value: invoiceDate },
  ]) {
    page.drawText(item.label, { x: ml, y, size: 7, font, color: muted });
    page.drawText(item.value, { x: ml + 90, y, size: 9, font, color: black });
    y -= 16;
  }

  y -= 10;
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 24;

  // Bill to
  page.drawText("BILL TO", { x: ml, y, size: 7, font: bold, color: muted });
  y -= 16;
  page.drawText(data.billTo.company, { x: ml, y, size: 11, font: bold, color: black });
  y -= 15;
  for (const line of data.billTo.addressLines) {
    page.drawText(line, { x: ml, y, size: 9, font, color: black });
    y -= 14;
  }
  if (data.billTo.email) {
    page.drawText(data.billTo.email, { x: ml, y, size: 9, font, color: black });
    y -= 14;
  }
  y -= 16;

  // Booking sections — replicate layout from account-invoice-pdf.ts
  for (const booking of data.bookings) {
    const serviceNames = parseServiceNames(booking.services);
    const blockHeight = 20 + 18 + serviceNames.length * 15 + 14 + 8 + 24;
    if (y - blockHeight < 120) ({ pg: page, y } = addPage());

    page.drawRectangle({ x: ml, y: y - 4, width: cw, height: 20, color: rgb(0.96, 0.94, 0.92) });
    const addr = `${booking.address}${booking.postcode ? `, ${booking.postcode}` : ""}`;
    page.drawText(addr, { x: ml + 8, y, size: 9, font: bold, color: black });

    const beds = `${booking.bedrooms}-bed`;
    const bedsW = font.widthOfTextAtSize(beds, 8);
    page.drawText(beds, { x: pageWidth - mr - 8 - bedsW, y: y + 1, size: 8, font, color: muted });
    y -= 20;

    const timeStr =
      booking.startTime && booking.endTime
        ? `${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
        : booking.startTime ? formatTime(booking.startTime) : "";
    const dateTimeStr = `${formatDate(booking.preferredDate)}${timeStr ? `  ·  ${timeStr}` : ""}`;
    page.drawText(dateTimeStr, { x: ml + 8, y, size: 8, font, color: muted });
    y -= 18;

    if (serviceNames.length > 0) {
      for (let i = 0; i < serviceNames.length; i++) {
        const isLast = i === serviceNames.length - 1;
        page.drawText(serviceNames[i], { x: ml + 8, y, size: 9, font, color: black });
        if (isLast) {
          const amountStr = pence(booking.total);
          const amountW = font.widthOfTextAtSize(amountStr, 9);
          page.drawText(amountStr, { x: pageWidth - mr - 8 - amountW, y, size: 9, font, color: black });
        }
        y -= 15;
      }
    } else {
      const amountStr = pence(booking.total);
      const amountW = font.widthOfTextAtSize(amountStr, 9);
      page.drawText(amountStr, { x: pageWidth - mr - 8 - amountW, y, size: 9, font, color: black });
      y -= 15;
    }

    page.drawRectangle({ x: ml, y: y + 6, width: cw, height: 0.5, color: muted });
    y -= 8;
    page.drawText("Subtotal", { x: ml + 8, y, size: 8, font, color: muted });
    const subStr = pence(booking.total);
    const subW = font.widthOfTextAtSize(subStr, 9);
    page.drawText(subStr, { x: pageWidth - mr - 8 - subW, y, size: 9, font, color: black });
    y -= 24;
  }

  // Totals
  if (y < 160) ({ pg: page, y } = addPage());
  page.drawRectangle({ x: ml, y, width: cw, height: 2, color: black });
  y -= 20;

  y -= 12;
  const totalBarH = 32;
  page.drawRectangle({ x: ml, y: y - 8, width: cw, height: totalBarH, color: black });
  page.drawText("TOTAL DUE", { x: ml + 10, y: y + 2, size: 10, font: bold, color: white });
  const totalStr = pence(data.totalAmount);
  const totalW = bold.widthOfTextAtSize(totalStr, 14);
  page.drawText(totalStr, { x: pageWidth - mr - 10 - totalW, y, size: 14, font: bold, color: white });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

export function readBillToFromEnv(): { company: string; addressLines: string[]; email?: string } {
  const company = process.env.WHITELABEL_INVOICE_COMPANY || "Company Name";
  const linesRaw = process.env.WHITELABEL_INVOICE_ADDRESS_LINES || "";
  const addressLines = linesRaw
    .split(/\r?\n|\\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const email = process.env.WHITELABEL_INVOICE_EMAIL || undefined;
  return { company, addressLines, email };
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/whitelabel-invoice-pdf.ts
git commit -m "feat(whitelabel): PDF generator for consolidated invoice"
```

---

## Task 6: Admin list + generate APIs

**Files:**
- Create: `src/app/api/admin/whitelabel-invoice/route.ts`
- Create: `src/app/api/admin/whitelabel-invoice/generate/route.ts`
- Create: `src/app/api/admin/whitelabel-invoice/[id]/pdf/route.ts`

- [ ] **Step 1: Inspect existing admin auth pattern**

Open any existing admin API route (e.g. `src/app/api/admin/invoices/[id]/retry/route.ts` or another under `src/app/api/admin/`). Note exactly how it checks admin auth (cookie, helper import, etc.). Use the identical pattern in the routes below — do not invent new auth logic.

Read: `src/app/api/admin/services/route.ts` if that's the clearest example. Call the admin-auth check at the top of each handler and return 401 when unauthorized.

- [ ] **Step 2: List endpoint — un-invoiced bookings and past invoices**

Create `src/app/api/admin/whitelabel-invoice/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { desc, isNull } from "drizzle-orm";
// Import the same admin-auth helper used in other /api/admin routes
import { requireAdmin } from "@/lib/admin-auth-helper"; // replace with actual path from Step 1

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const pending = await db
    .select()
    .from(bookingsWhitelabel)
    .where(isNull(bookingsWhitelabel.whitelabelInvoiceId))
    .orderBy(desc(bookingsWhitelabel.preferredDate));

  const past = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt));

  return NextResponse.json({ pending, past });
}
```

Replace the `requireAdmin` import with the actual helper from Step 1. If the pattern is inline (e.g. `const session = await getAdminSession(); if (!session) return NextResponse.json(..., { status: 401 });`), inline it the same way.

- [ ] **Step 3: Generate endpoint**

Create `src/app/api/admin/whitelabel-invoice/generate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { and, isNull, eq, desc } from "drizzle-orm";
import { generateWhitelabelInvoicePdf, readBillToFromEnv } from "@/lib/whitelabel-invoice-pdf";
// Admin auth — match Step 1 pattern
import { requireAdmin } from "@/lib/admin-auth-helper";

function nextInvoiceNumber(existing: string | undefined): string {
  if (!existing) return "WL-0001";
  const m = existing.match(/WL-(\d+)/);
  const n = m ? parseInt(m[1], 10) + 1 : 1;
  return `WL-${String(n).padStart(4, "0")}`;
}

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const pending = await db
    .select()
    .from(bookingsWhitelabel)
    .where(isNull(bookingsWhitelabel.whitelabelInvoiceId));

  if (pending.length === 0) {
    return NextResponse.json({ error: "No un-invoiced bookings" }, { status: 400 });
  }

  const latest = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt))
    .limit(1);
  const invoiceNumber = nextInvoiceNumber(latest[0]?.invoiceNumber);

  const totalAmount = pending.reduce((sum, b) => sum + b.total, 0);
  const invoiceId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  await db.insert(whitelabelInvoices).values({
    id: invoiceId,
    invoiceNumber,
    totalAmount,
    bookingCount: pending.length,
    generatedAt,
  });

  // Link bookings
  for (const b of pending) {
    await db
      .update(bookingsWhitelabel)
      .set({ whitelabelInvoiceId: invoiceId })
      .where(eq(bookingsWhitelabel.id, b.id));
  }

  const pdf = await generateWhitelabelInvoicePdf({
    invoiceNumber,
    generatedAt,
    billTo: readBillToFromEnv(),
    bookings: pending.map((b) => ({
      address: b.address,
      postcode: b.postcode,
      bedrooms: b.bedrooms,
      preferredDate: b.preferredDate,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.services,
      total: b.total,
    })),
    totalAmount,
  });

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 4: Re-download endpoint**

Create `src/app/api/admin/whitelabel-invoice/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generateWhitelabelInvoicePdf, readBillToFromEnv } from "@/lib/whitelabel-invoice-pdf";
import { requireAdmin } from "@/lib/admin-auth-helper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const invoice = (await db.select().from(whitelabelInvoices).where(eq(whitelabelInvoices.id, id)))[0];
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const items = await db
    .select()
    .from(bookingsWhitelabel)
    .where(eq(bookingsWhitelabel.whitelabelInvoiceId, id));

  const pdf = await generateWhitelabelInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    generatedAt: invoice.generatedAt ?? new Date().toISOString(),
    billTo: readBillToFromEnv(),
    bookings: items.map((b) => ({
      address: b.address,
      postcode: b.postcode,
      bedrooms: b.bedrooms,
      preferredDate: b.preferredDate,
      startTime: b.startTime,
      endTime: b.endTime,
      services: b.services,
      total: b.total,
    })),
    totalAmount: invoice.totalAmount,
  });

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors. Fix any import-path errors from the `requireAdmin` helper mismatch by inlining the actual admin-auth check as used elsewhere.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/whitelabel-invoice/
git commit -m "feat(whitelabel): admin API for listing and generating invoices"
```

---

## Task 7: Admin page — whitelabel invoice UI

**Files:**
- Create: `src/app/admin/whitelabel-invoice/page.tsx`
- Create: `src/app/admin/whitelabel-invoice/page.module.css`
- Modify: `src/app/admin/components/AdminNav.tsx`

- [ ] **Step 1: Add nav link**

In `src/app/admin/components/AdminNav.tsx`, add a link before the logout button:

```tsx
<Link
  href="/admin/whitelabel-invoice"
  className={`${styles.link} ${pathname?.startsWith('/admin/whitelabel-invoice') ? styles.active : ''}`}
>
  Whitelabel
</Link>
```

- [ ] **Step 2: Create the page**

Create `src/app/admin/whitelabel-invoice/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface PendingBooking {
  id: string;
  address: string;
  postcode: string | null;
  preferredDate: string;
  agentName: string;
  agentCompany: string | null;
  total: number;
  services: string;
}

interface PastInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  bookingCount: number;
  generatedAt: string | null;
}

function pence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function WhitelabelInvoicePage() {
  const [pending, setPending] = useState<PendingBooking[]>([]);
  const [past, setPast] = useState<PastInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/whitelabel-invoice");
    if (res.ok) {
      const data = await res.json();
      setPending(data.pending);
      setPast(data.past);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = pending.reduce((sum, b) => sum + b.total, 0);

  const handleGenerate = useCallback(async () => {
    if (!pending.length) return;
    if (!confirm(`Generate invoice for ${pending.length} bookings — ${pence(total)}?`)) return;
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/whitelabel-invoice/generate", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      a.download = match?.[1] || "invoice.pdf";
      a.click();
      URL.revokeObjectURL(url);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setGenerating(false);
    }
  }, [pending, total, load]);

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Whitelabel Invoicing</h1>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.subheading}>Un-invoiced bookings</h2>
            <button
              className={styles.generateBtn}
              onClick={handleGenerate}
              disabled={generating || pending.length === 0}
            >
              {generating ? "Generating..." : `Generate Invoice PDF (${pence(total)})`}
            </button>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : pending.length === 0 ? (
            <p className={styles.empty}>No un-invoiced bookings.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Address</th>
                  <th>Booked by</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((b) => (
                  <tr key={b.id}>
                    <td>{formatDate(b.preferredDate)}</td>
                    <td>{b.address}{b.postcode ? `, ${b.postcode}` : ""}</td>
                    <td>{b.agentName}{b.agentCompany ? ` · ${b.agentCompany}` : ""}</td>
                    <td style={{ textAlign: "right" }}>{pence(b.total)}</td>
                  </tr>
                ))}
                <tr className={styles.totalRow}>
                  <td colSpan={3}><strong>Total</strong></td>
                  <td style={{ textAlign: "right" }}><strong>{pence(total)}</strong></td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.section}>
          <h2 className={styles.subheading}>Past invoices</h2>
          {past.length === 0 ? (
            <p className={styles.empty}>None yet.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Bookings</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {past.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.generatedAt ? formatDate(inv.generatedAt.slice(0, 10)) : "—"}</td>
                    <td>{inv.bookingCount}</td>
                    <td style={{ textAlign: "right" }}>{pence(inv.totalAmount)}</td>
                    <td><a href={`/api/admin/whitelabel-invoice/${inv.id}/pdf`}>Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create stylesheet**

Create `src/app/admin/whitelabel-invoice/page.module.css`:

```css
.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}
.heading {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 24px;
}
.section {
  margin-bottom: 40px;
  border: 1px solid #e7e3de;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
}
.sectionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.subheading {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.generateBtn {
  background: #0a0a0a;
  color: #fff;
  border: 0;
  padding: 10px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.generateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th,
.table td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid #f0ece7;
}
.table th {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8a857f;
  font-weight: 600;
}
.totalRow td {
  border-top: 2px solid #0a0a0a;
  border-bottom: 0;
  padding-top: 14px;
}
.empty {
  color: #8a857f;
  font-size: 14px;
  margin: 0;
}
.error {
  color: #c23b3b;
  font-size: 14px;
  margin: 0 0 12px;
}
```

- [ ] **Step 4: Manual verification**

Set env vars locally (in `.env.local`):

```
WHITELABEL_INVOICE_COMPANY=Example Employer Ltd
WHITELABEL_INVOICE_ADDRESS_LINES=12 Example Street\nBrighton BN1 1AA
WHITELABEL_INVOICE_EMAIL=billing@example.com
```

Make sure at least one `bookings_whitelabel` row exists (from Task 4's manual test). Log into admin at `http://localhost:3000/admin/login`. Navigate to `/admin/whitelabel-invoice`. Verify:
- Un-invoiced bookings table populated with running total.
- Click "Generate Invoice PDF" → PDF downloads.
- Page reloads; the booking has moved out of pending; a new row appears under "Past invoices".
- Click "Download" on the past invoice — PDF re-downloads identically.
- Running total is now £0 / empty state.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/whitelabel-invoice/ src/app/admin/components/AdminNav.tsx
git commit -m "feat(whitelabel): admin page to generate consolidated invoice PDFs"
```

---

## Task 8: Final verification

- [ ] **Step 1: Typecheck + tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx jest`
Expected: all tests pass.

- [ ] **Step 2: End-to-end manual check**

With both brands:

**Whitelabel (`http://localhost:3100`):**
- Book a property → "Submit Booking" → success block shown.
- Row in `bookings_whitelabel`, none in `bookings`.

**Main (`http://localhost:3000`):**
- Booking flow still offers Pay Now and trade account options — unchanged.
- Row in `bookings`, none in `bookings_whitelabel`.

**Admin:**
- `/admin/whitelabel-invoice` lists whitelabel bookings only.
- Main admin bookings page (`/admin/bookings`) unchanged — still queries only `bookings`.

- [ ] **Step 3: Note the known gap**

The main admin calendar does not show whitelabel bookings. This is intentional per the spec's "out of scope" section and will be addressed in a follow-up (booking double-booking risk for Harrison). No action here beyond confirming it's documented.
