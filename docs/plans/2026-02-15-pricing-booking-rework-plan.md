# Pricing & Booking Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the booking system with updated pricing, drone photography as independent service, video drone add-ons, notes field, multi-property discount, and disclaimer section.

**Architecture:** Update pricing.ts first (foundation), then Services display, then PropertyBlock UI, then BookingSection (interface + disclaimer), then Basket (line items + discount), and finally the Stripe checkout API route. Each task builds on the previous.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, Stripe

---

### Task 1: Update pricing.ts with new constants and functions

**Files:**
- Modify: `src/lib/pricing.ts`

**Step 1: Rewrite pricing.ts**

Replace the entire contents of `src/lib/pricing.ts` with:

```typescript
const PHOTO_PRICE = 6.5;
const PHOTO_MIN = 20;
const PHOTO_BULK_THRESHOLD = 100;
const PHOTO_BULK_DISCOUNT = 0.1;

const VIDEO_BASE = 125;
const VIDEO_PER_BEDROOM = 30;
const VIDEO_BASE_BEDROOMS = 2;

const AGENT_PRESENTED_MULTIPLIER = 1.5;

const DRONE_PHOTO_8_PRICE = 75;
const DRONE_PHOTO_20_PRICE = 140;
const DRONE_VIDEO_PRICE = 65;

const MULTI_PROPERTY_DISCOUNT = 15;

export function calcPhotography(count: number): number {
  const actual = Math.max(count, PHOTO_MIN);
  const subtotal = actual * PHOTO_PRICE;
  if (actual >= PHOTO_BULK_THRESHOLD) {
    return Math.round(subtotal * (1 - PHOTO_BULK_DISCOUNT) * 100) / 100;
  }
  return subtotal;
}

export function calcStandardVideo(bedrooms: number): number {
  return VIDEO_BASE + Math.max(0, bedrooms - VIDEO_BASE_BEDROOMS) * VIDEO_PER_BEDROOM;
}

export function calcAgentPresentedVideo(bedrooms: number): number {
  return calcStandardVideo(bedrooms) * AGENT_PRESENTED_MULTIPLIER;
}

export function calcDronePhotography(count: 8 | 20): number {
  return count === 8 ? DRONE_PHOTO_8_PRICE : DRONE_PHOTO_20_PRICE;
}

export function calcVideoDrone(): number {
  return DRONE_VIDEO_PRICE;
}

export function calcMultiPropertyDiscount(propertyCount: number): number {
  if (propertyCount <= 1) return 0;
  return (propertyCount - 1) * MULTI_PROPERTY_DISCOUNT;
}

export interface PropertyServices {
  bedrooms: number;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
}

export function calcPropertyTotal(services: PropertyServices): number {
  let total = 0;

  if (services.photography) {
    total += calcPhotography(services.photoCount);
  }

  if (services.dronePhotography) {
    total += calcDronePhotography(services.dronePhotoCount);
  }

  if (services.agentPresentedVideo) {
    total += calcAgentPresentedVideo(services.bedrooms);
    if (services.agentPresentedVideoDrone) {
      total += calcVideoDrone();
    }
  } else if (services.standardVideo) {
    total += calcStandardVideo(services.bedrooms);
    if (services.standardVideoDrone) {
      total += calcVideoDrone();
    }
  }

  return total;
}
```

**Step 2: Build and verify**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npx tsc --noEmit`
Expected: Type errors in components that use old interface (PropertyBlock, Basket, route.ts). That's expected — we fix them in subsequent tasks.

**Step 3: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat: update pricing with drone photography, video drone add-on, multi-property discount"
```

---

### Task 2: Update Services.tsx display cards

**Files:**
- Modify: `src/components/Services.tsx`

**Step 1: Update the services array**

In `src/components/Services.tsx`, replace the `services` array (lines 7-31) with:

```typescript
const services = [
  {
    name: "Photography",
    price: "From £130",
    details: ["£6.50 per photo · Min 20 per property", "10% off for 100+ photos"],
  },
  {
    name: "Drone Photography",
    price: "From £75",
    details: ["8 photos — £75", "20 photos — £140"],
  },
  {
    name: "Unpresented Property Video",
    price: "From £125",
    details: ["2-bed base · +£30 per extra bedroom", "Add drone footage for +£65"],
  },
  {
    name: "Agent Presented Video",
    price: "From £187.50",
    details: [
      "Guided tour with your agent on camera",
      "Directed by Harrison · +£45 per extra bedroom",
    ],
  },
];
```

**Step 2: Verify build**

Run: `npm run build`
Expected: May still have errors from other components. Services itself should compile fine.

**Step 3: Commit**

```bash
git add src/components/Services.tsx
git commit -m "feat: update service cards — rename to Drone Photography and Unpresented Property Video"
```

---

### Task 3: Update PropertyBooking interface and BookingSection

**Files:**
- Modify: `src/components/BookingSection.tsx`
- Modify: `src/components/BookingSection.module.css`

**Step 1: Update the PropertyBooking interface and createProperty function**

In `src/components/BookingSection.tsx`, replace lines 18-42 (the interface and createProperty function) with:

```typescript
export interface PropertyBooking {
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

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    bedrooms: 2,
    preferredDate: "",
    notes: "",
    photography: false,
    photoCount: 20,
    dronePhotography: false,
    dronePhotoCount: 8,
    standardVideo: false,
    standardVideoDrone: false,
    agentPresentedVideo: false,
    agentPresentedVideoDrone: false,
  };
}
```

**Step 2: Add disclaimer section below the form**

In the same file, replace the return JSX (lines 67-93) with:

```tsx
  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Book" id="book" number="03 — Get Started" />
        <div className={styles.layout}>
          <div className={styles.form}>
            <AgentDetails agent={agent} onChange={setAgent} />
            {properties.map((property) => (
              <PropertyBlock
                key={property.id}
                property={property}
                onChange={(updates) => updateProperty(property.id, updates)}
                onRemove={() => removeProperty(property.id)}
                canRemove={properties.length > 1}
              />
            ))}
            <button className={styles.addProperty} onClick={addProperty}>
              + Add Another Property
            </button>

            <div className={styles.disclaimer}>
              <h4 className={styles.disclaimerTitle}>Important Information</h4>
              <ul className={styles.disclaimerList}>
                <li>Unpresented property videos are allocated 1 hour per shoot. Agent-presented videos are allocated 2 hours. Additional time may incur extra charges.</li>
                <li>Properties must include a full address. Shoots within 10 miles of Brighton are included. Properties beyond 10 miles will incur a per-mile travel charge, quoted separately.</li>
                <li>Multi-property bookings on the same day receive £15 off each additional property.</li>
                <li>All prices are exclusive of VAT.</li>
              </ul>
            </div>
          </div>
          <div className={styles.basket}>
            <Basket properties={properties} agent={agent} />
          </div>
        </div>
      </div>
    </section>
  );
```

**Step 3: Add disclaimer styles**

Append the following to `src/components/BookingSection.module.css` (before the `@media` block at line 47):

```css
.disclaimer {
  margin-top: 2.5rem;
  padding: 2rem;
  border: 1px solid var(--color-border);
}

.disclaimerTitle {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 1.25rem;
}

.disclaimerList {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.disclaimerList li {
  font-size: 0.85rem;
  line-height: 1.65;
  color: var(--color-muted);
  padding-left: 1rem;
  position: relative;
}

.disclaimerList li::before {
  content: "·";
  position: absolute;
  left: 0;
  font-weight: 700;
}
```

**Step 4: Commit**

```bash
git add src/components/BookingSection.tsx src/components/BookingSection.module.css
git commit -m "feat: update PropertyBooking interface, add disclaimer section"
```

---

### Task 4: Rewrite PropertyBlock with new services UI

**Files:**
- Modify: `src/components/PropertyBlock.tsx`
- Modify: `src/components/PropertyBlock.module.css`

**Step 1: Rewrite PropertyBlock.tsx**

Replace the entire contents of `src/components/PropertyBlock.tsx` with:

```tsx
import type { PropertyBooking } from "./BookingSection";
import { calcPropertyTotal } from "@/lib/pricing";
import styles from "./PropertyBlock.module.css";

interface Props {
  property: PropertyBooking;
  onChange: (updates: Partial<PropertyBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function PropertyBlock({
  property,
  onChange,
  onRemove,
  canRemove,
}: Props) {
  const togglePhotography = () => {
    onChange({ photography: !property.photography });
  };

  const toggleDronePhotography = () => {
    onChange({ dronePhotography: !property.dronePhotography });
  };

  const toggleStandardVideo = () => {
    const next = !property.standardVideo;
    onChange({
      standardVideo: next,
      agentPresentedVideo: false,
      agentPresentedVideoDrone: false,
      standardVideoDrone: next ? property.standardVideoDrone : false,
    });
  };

  const toggleAgentPresentedVideo = () => {
    const next = !property.agentPresentedVideo;
    onChange({
      agentPresentedVideo: next,
      standardVideo: false,
      standardVideoDrone: false,
      agentPresentedVideoDrone: next ? property.agentPresentedVideoDrone : false,
    });
  };

  const subtotal = calcPropertyTotal(property);

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <span className={styles.label}>Property</span>
        {canRemove && (
          <button className={styles.remove} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Address</span>
          <input
            type="text"
            value={property.address}
            onChange={(e) => onChange({ address: e.target.value })}
            className={styles.input}
            placeholder="Full property address"
            required
          />
        </label>

        <div className={styles.row}>
          <label className={styles.field}>
            <span>Bedrooms</span>
            <select
              value={property.bedrooms}
              onChange={(e) =>
                onChange({ bedrooms: parseInt(e.target.value, 10) })
              }
              className={styles.input}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 6 ? "6+" : n}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Preferred Date</span>
            <input
              type="date"
              value={property.preferredDate}
              onChange={(e) => onChange({ preferredDate: e.target.value })}
              className={styles.input}
              required
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Notes &amp; Access</span>
          <textarea
            value={property.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            className={`${styles.input} ${styles.textarea}`}
            placeholder="Key/lockbox codes, parking info, access instructions..."
            rows={3}
          />
        </label>
      </div>

      <div className={styles.services}>
        <span className={styles.servicesLabel}>Services</span>

        {/* Photography */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.photography ? styles.active : ""}`}
            onClick={togglePhotography}
            type="button"
          >
            Photography
          </button>
          {property.photography && (
            <label className={styles.serviceOption}>
              <span>Number of photos</span>
              <input
                type="number"
                min={20}
                value={property.photoCount}
                onChange={(e) =>
                  onChange({ photoCount: Math.max(20, parseInt(e.target.value, 10) || 20) })
                }
                className={styles.input}
              />
            </label>
          )}
        </div>

        {/* Drone Photography */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.dronePhotography ? styles.active : ""}`}
            onClick={toggleDronePhotography}
            type="button"
          >
            Drone Photography
          </button>
          {property.dronePhotography && (
            <label className={styles.serviceOption}>
              <span>Package</span>
              <select
                value={property.dronePhotoCount}
                onChange={(e) =>
                  onChange({ dronePhotoCount: parseInt(e.target.value, 10) as 8 | 20 })
                }
                className={styles.input}
              >
                <option value={8}>8 photos — £75</option>
                <option value={20}>20 photos — £140</option>
              </select>
            </label>
          )}
        </div>

        {/* Unpresented Property Video */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.standardVideo ? styles.active : ""}`}
            onClick={toggleStandardVideo}
            type="button"
          >
            Unpresented Property Video
          </button>
          {property.standardVideo && (
            <label className={styles.serviceOption}>
              <input
                type="checkbox"
                checked={property.standardVideoDrone}
                onChange={(e) => onChange({ standardVideoDrone: e.target.checked })}
                className={styles.checkbox}
              />
              <span>Add drone footage (+£65)</span>
            </label>
          )}
        </div>

        {/* Agent Presented Video */}
        <div className={styles.serviceGroup}>
          <button
            className={`${styles.pill} ${property.agentPresentedVideo ? styles.active : ""}`}
            onClick={toggleAgentPresentedVideo}
            type="button"
          >
            Agent Presented Video
          </button>
          {property.agentPresentedVideo && (
            <label className={styles.serviceOption}>
              <input
                type="checkbox"
                checked={property.agentPresentedVideoDrone}
                onChange={(e) => onChange({ agentPresentedVideoDrone: e.target.checked })}
                className={styles.checkbox}
              />
              <span>Add drone footage (+£65)</span>
            </label>
          )}
        </div>
      </div>

      {subtotal > 0 && (
        <div className={styles.subtotal}>
          Subtotal: <strong>&pound;{subtotal.toFixed(2)}</strong>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Update PropertyBlock.module.css**

Replace the entire contents of `src/components/PropertyBlock.module.css` with:

```css
.block {
  border: 1px solid var(--color-border);
  padding: 2rem;
  margin-bottom: 1.5rem;
  transition: border-color 0.2s ease;
}

.block:focus-within {
  border-color: var(--color-text);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.label {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-style: italic;
}

.remove {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-muted);
  transition: color 0.2s ease;
}

.remove:hover {
  color: var(--color-text);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.input {
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  background: transparent;
  outline: none;
  transition: background-color 0.2s ease;
  -webkit-appearance: none;
  appearance: none;
}

.input:focus {
  background-color: var(--color-white);
}

.textarea {
  resize: vertical;
  min-height: 3.5rem;
  line-height: 1.5;
}

/* ── Services ── */

.services {
  margin-bottom: 1.5rem;
}

.servicesLabel {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 0.75rem;
}

.serviceGroup {
  margin-bottom: 0.5rem;
}

.pill {
  font-family: var(--font-body);
  font-size: 0.875rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  padding: 0.65rem 1.25rem;
  border: 1px solid var(--color-border);
  background: transparent;
  transition: background-color 0.2s ease, color 0.2s ease;
  width: 100%;
  text-align: left;
}

.pill:hover {
  background-color: var(--color-text);
  color: var(--color-white);
}

.active {
  background-color: var(--color-text);
  color: var(--color-white);
}

.active:hover {
  opacity: 0.85;
}

.serviceOption {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.85rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 0.75rem 1.25rem;
  border: 1px solid var(--color-border);
  border-top: none;
  background: rgba(0, 0, 0, 0.02);
}

.serviceOption .input {
  max-width: 180px;
}

.checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--color-text);
  cursor: pointer;
  flex-shrink: 0;
}

/* ── Subtotal ── */

.subtotal {
  font-size: 0.85rem;
  text-align: right;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
  letter-spacing: -0.01em;
}

.subtotal strong {
  font-size: 1rem;
  font-weight: 700;
}

@media (max-width: 500px) {
  .row {
    grid-template-columns: 1fr;
  }
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Should compile now that PropertyBlock matches the new interface. Basket and route.ts may still error.

**Step 4: Commit**

```bash
git add src/components/PropertyBlock.tsx src/components/PropertyBlock.module.css
git commit -m "feat: rework PropertyBlock with notes, drone photography, video drone add-ons"
```

---

### Task 5: Update Basket with new line items and multi-property discount

**Files:**
- Modify: `src/components/Basket.tsx`
- Modify: `src/components/Basket.module.css`

**Step 1: Rewrite Basket.tsx**

Replace the entire contents of `src/components/Basket.tsx` with:

```tsx
"use client";

import { useState, useCallback } from "react";
import type { PropertyBooking, AgentInfo } from "./BookingSection";
import {
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcPropertyTotal,
  calcMultiPropertyDiscount,
} from "@/lib/pricing";
import styles from "./Basket.module.css";

interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
}

function getLineItems(property: PropertyBooking) {
  const items: { label: string; price: number; indent?: boolean }[] = [];

  if (property.photography) {
    const price = calcPhotography(property.photoCount);
    const bulkApplied = property.photoCount >= 100;
    items.push({
      label: `Photography (${property.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
      price,
    });
  }

  if (property.dronePhotography) {
    items.push({
      label: `Drone Photography (${property.dronePhotoCount} photos)`,
      price: calcDronePhotography(property.dronePhotoCount),
    });
  }

  if (property.agentPresentedVideo) {
    items.push({
      label: `Agent Presented Video (${property.bedrooms}-bed)`,
      price: calcAgentPresentedVideo(property.bedrooms),
    });
    if (property.agentPresentedVideoDrone) {
      items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
    }
  } else if (property.standardVideo) {
    items.push({
      label: `Unpresented Video (${property.bedrooms}-bed)`,
      price: calcStandardVideo(property.bedrooms),
    });
    if (property.standardVideoDrone) {
      items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
    }
  }

  return items;
}

export default function Basket({ properties, agent }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const propertyTotals = properties.map((p) => ({
    property: p,
    items: getLineItems(p),
    subtotal: calcPropertyTotal(p),
  }));

  const subtotalBeforeDiscount = propertyTotals.reduce((sum, p) => sum + p.subtotal, 0);
  const discount = calcMultiPropertyDiscount(properties.length);
  const grandTotal = Math.max(0, subtotalBeforeDiscount - discount);
  const hasItems = subtotalBeforeDiscount > 0;

  const handleCheckout = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties, agent }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [properties, agent]);

  const basketContent = (
    <>
      {propertyTotals.map(({ property, items, subtotal }) => {
        if (items.length === 0) return null;
        return (
          <div key={property.id} className={styles.property}>
            <p className={styles.address}>
              {property.address || "No address yet"}
            </p>
            {items.map((item) => (
              <div key={item.label} className={`${styles.lineItem} ${item.indent ? styles.indented : ""}`}>
                <span>{item.indent ? `+ ${item.label}` : item.label}</span>
                <span>£{item.price.toFixed(2)}</span>
              </div>
            ))}
            <div className={styles.propertySubtotal}>
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
          </div>
        );
      })}

      {discount > 0 && (
        <div className={styles.discountLine}>
          <span>Multi-property discount ({properties.length} properties)</span>
          <span>-£{discount.toFixed(2)}</span>
        </div>
      )}

      <div className={styles.total}>
        <span>Total</span>
        <span>£{grandTotal.toFixed(2)}</span>
      </div>

      <button
        className={styles.checkout}
        onClick={handleCheckout}
        disabled={!hasItems || loading}
      >
        {loading ? "Redirecting…" : "Proceed to Payment"}
      </button>
    </>
  );

  return (
    <>
      {/* Desktop basket */}
      <div className={styles.desktop}>
        <h3 className={styles.heading}>Your Booking</h3>
        {hasItems ? (
          basketContent
        ) : (
          <p className={styles.empty}>Select services to get started</p>
        )}
      </div>

      {/* Mobile bottom bar */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileBarInner}>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "Hide Basket" : "View Basket"} — £
            {grandTotal.toFixed(2)}
          </button>
          <button
            className={styles.mobileCheckout}
            onClick={handleCheckout}
            disabled={!hasItems || loading}
          >
            {loading ? "…" : "Pay"}
          </button>
        </div>
        {mobileOpen && (
          <div className={styles.mobilePanel}>{basketContent}</div>
        )}
      </div>
    </>
  );
}
```

**Step 2: Add indented and discount styles to Basket.module.css**

Add the following after the `.propertySubtotal` rule (after line 51) in `src/components/Basket.module.css`:

```css
.indented {
  padding-left: 1rem;
  font-size: 0.825rem;
}

.discountLine {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  padding: 0.75rem 0;
  color: #2d7a3a;
  font-weight: 500;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 0.75rem;
}
```

**Step 3: Build and verify**

Run: `npm run build`
Expected: Should compile. Only route.ts may still have type issues.

**Step 4: Commit**

```bash
git add src/components/Basket.tsx src/components/Basket.module.css
git commit -m "feat: update basket with drone photography, video drone add-ons, multi-property discount"
```

---

### Task 6: Update Stripe checkout API route

**Files:**
- Modify: `src/app/api/checkout/route.ts`

**Step 1: Rewrite the checkout route**

Replace the entire contents of `src/app/api/checkout/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcMultiPropertyDiscount,
  type PropertyServices,
} from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

interface PropertyPayload extends PropertyServices {
  id: string;
  address: string;
  preferredDate: string;
  notes: string;
}

interface CheckoutBody {
  properties: PropertyPayload[];
  agent: {
    name: string;
    company: string;
    email: string;
    phone: string;
  };
}

function buildLineItems(
  properties: PropertyPayload[]
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const p of properties) {
    const label = p.address || "Property";

    if (p.photography) {
      const price = calcPhotography(p.photoCount);
      const bulkApplied = p.photoCount >= 100;
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Photography (${p.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
    }

    if (p.dronePhotography) {
      const price = calcDronePhotography(p.dronePhotoCount);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Drone Photography (${p.dronePhotoCount} photos)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
    }

    if (p.agentPresentedVideo) {
      const price = calcAgentPresentedVideo(p.bedrooms);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Agent Presented Video (${p.bedrooms}-bed)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
      if (p.agentPresentedVideoDrone) {
        items.push({
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Drone Footage (with Agent Presented Video)",
              description: label,
            },
            unit_amount: Math.round(calcVideoDrone() * 100),
          },
          quantity: 1,
        });
      }
    } else if (p.standardVideo) {
      const price = calcStandardVideo(p.bedrooms);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Unpresented Property Video (${p.bedrooms}-bed)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
      if (p.standardVideoDrone) {
        items.push({
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Drone Footage (with Unpresented Video)",
              description: label,
            },
            unit_amount: Math.round(calcVideoDrone() * 100),
          },
          quantity: 1,
        });
      }
    }
  }

  // Multi-property discount
  const discount = calcMultiPropertyDiscount(properties.length);
  if (discount > 0) {
    items.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: `Multi-property discount (${properties.length} properties)`,
        },
        unit_amount: -Math.round(discount * 100),
      },
      quantity: 1,
    });
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const body: CheckoutBody = await request.json();
    const { properties, agent } = body;

    if (!properties?.length) {
      return NextResponse.json(
        { error: "No properties provided" },
        { status: 400 }
      );
    }

    const lineItems = buildLineItems(properties);

    // Filter out any discount-only submissions
    const serviceItems = lineItems.filter(
      (item) => (item.price_data as { unit_amount: number }).unit_amount > 0
    );

    if (!serviceItems.length) {
      return NextResponse.json(
        { error: "No services selected" },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: agent.email || undefined,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/#book`,
      metadata: {
        agent_name: agent.name,
        agent_company: agent.company,
        agent_email: agent.email,
        agent_phone: agent.phone,
        properties: JSON.stringify(
          properties.map((p) => ({
            address: p.address,
            bedrooms: p.bedrooms,
            preferredDate: p.preferredDate,
            notes: p.notes,
          }))
        ),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
```

**Step 2: Build and verify**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npm run build`
Expected: Clean build, no errors. All components and the API route should compile.

**Step 3: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: update Stripe checkout with drone photography, video drone, multi-property discount"
```

---

### Task 7: Final build verification and QA

**Step 1: Full production build**

Run: `cd /Users/omarmaroki/Projects/hrproductions && npm run build`
Expected: Clean build, all 6 pages generate.

**Step 2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Manual verification checklist**

Run dev server: `npm run dev`

Verify:
- [ ] Services section shows: Photography, Drone Photography, Unpresented Property Video, Agent Presented Video
- [ ] PropertyBlock has: address, bedrooms, date, notes textarea
- [ ] Photography toggle shows photo count input
- [ ] Drone Photography toggle shows 8/20 dropdown
- [ ] Unpresented Video toggle shows "Add drone footage (+£65)" checkbox
- [ ] Agent Presented Video toggle shows "Add drone footage (+£65)" checkbox
- [ ] Video types are mutually exclusive
- [ ] Basket shows correct line items for each service
- [ ] Multi-property discount appears in basket when 2+ properties
- [ ] Disclaimer section appears below the booking form
- [ ] Mobile layout works

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: QA refinements for pricing and booking rework"
```
