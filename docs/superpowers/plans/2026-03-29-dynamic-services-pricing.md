# Dynamic Services & Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded pricing with a database-driven services system. Admins can CRUD services with custom pricing formulas and configure per-brand (main/whitelabel) visibility and pricing overrides.

**Architecture:** Three new DB tables (`serviceCategories`, `services`, `serviceBrandOverrides`) store service definitions with JSON pricing/duration rules. A shared `pricing-engine.ts` evaluates rules on both client and server. The admin UI at `/admin/services` provides full CRUD. The booking form, checkout, scheduling, webhook, and invoice PDFs are updated to use dynamic services.

**Tech Stack:** Next.js 16, Drizzle ORM, Turso (SQLite), Stripe, React, CSS Modules

---

## File Structure

### New Files
- `src/lib/pricing-engine.ts` — Shared rule evaluation functions (evaluatePrice, evaluateDuration, validateInputs)
- `src/lib/services.ts` — Service fetching/resolution with brand overrides
- `src/app/admin/services/page.tsx` — Admin services CRUD page
- `src/app/admin/services/page.module.css` — Styles for admin services page
- `src/app/api/admin/services/route.ts` — Admin API: list all, create service
- `src/app/api/admin/services/[id]/route.ts` — Admin API: update, delete service
- `src/app/api/admin/service-categories/route.ts` — Admin API: list, create categories
- `src/app/api/admin/service-categories/[id]/route.ts` — Admin API: update, delete category
- `src/app/api/services/route.ts` — Public API: get active services for a brand
- `src/lib/seed-services.ts` — Migration script to seed existing services

### Modified Files
- `src/lib/schema.ts` — Add 3 new tables
- `src/lib/scheduling.ts` — Replace hardcoded durations with evaluateDuration()
- `src/components/PropertyBlock.tsx` — Dynamic service rendering from DB
- `src/components/BookingSection.tsx` — Fetch services, new PropertyBooking shape
- `src/components/Basket.tsx` — Use evaluatePrice() instead of hardcoded calc functions
- `src/app/api/checkout/route.ts` — Use dynamic pricing engine
- `src/app/api/webhook/stripe/route.ts` — Use stored service names instead of recalculating
- `src/app/api/portal/signup-with-booking/route.ts` — Use dynamic pricing
- `src/lib/invoice-pdf.ts` — No changes needed (already uses ServiceLine[] interface)
- `src/lib/account-invoice-pdf.ts` — Update parseServiceNames to use stored names
- `src/app/admin/components/AdminNav.tsx` — Add Services link

### Deleted Files
- `src/lib/pricing.ts` — Replaced entirely by pricing-engine.ts + database

---

## Task 1: Database Schema — New Tables

**Files:**
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Add serviceCategories, services, and serviceBrandOverrides tables**

Add these table definitions at the end of `src/lib/schema.ts`:

```typescript
export const serviceCategories = sqliteTable("service_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  pricingRules: text("pricing_rules").notNull(), // JSON
  durationRules: text("duration_rules").notNull(), // JSON
  inputFields: text("input_fields").notNull(), // JSON
  isAddon: integer("is_addon").notNull().default(0),
  parentServiceId: text("parent_service_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  visible: integer("visible").notNull().default(1),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const serviceBrandOverrides = sqliteTable("service_brand_overrides", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  brandMode: text("brand_mode").notNull(), // "main" | "whitelabel"
  visible: integer("visible").notNull().default(1),
  pricingRules: text("pricing_rules"), // nullable JSON — null = use default
  durationRules: text("duration_rules"), // nullable JSON
  inputFields: text("input_fields"), // nullable JSON
});
```

- [ ] **Step 2: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/schema.ts drizzle/
git commit -m "feat: add service_categories, services, service_brand_overrides tables"
```

---

## Task 2: Pricing Engine — Core Evaluation Functions

**Files:**
- Create: `src/lib/pricing-engine.ts`

- [ ] **Step 1: Create the pricing engine with types and evaluation functions**

```typescript
// src/lib/pricing-engine.ts

// ── Types ──

export interface PricingRulePerUnit {
  type: "perUnit";
  input: string;
  rate: number;
  freeUnits: number;
}

export interface PricingRuleBulkDiscount {
  type: "bulkDiscount";
  input: string;
  threshold: number;
  percent: number;
}

export interface PricingRuleFixedTier {
  type: "fixedTier";
  tiers: { label: string; value: number | string; price: number }[];
}

export interface PricingRuleMinimum {
  type: "minimum";
  input: string;
  minValue: number;
}

export interface PricingRuleFlatRate {
  type: "flatRate";
}

export type PricingRule =
  | PricingRulePerUnit
  | PricingRuleBulkDiscount
  | PricingRuleFixedTier
  | PricingRuleMinimum
  | PricingRuleFlatRate;

export interface PricingRules {
  basePrice: number;
  rules: PricingRule[];
}

export interface InputFieldNumber {
  key: string;
  label: string;
  type: "number";
  min?: number;
  max?: number;
  default?: number;
}

export interface InputFieldSelect {
  key: string;
  label: string;
  type: "select";
  options: { value: string | number; label: string }[];
  default?: string | number;
}

export interface InputFieldBoolean {
  key: string;
  label: string;
  type: "boolean";
  default?: boolean;
}

export type InputField = InputFieldNumber | InputFieldSelect | InputFieldBoolean;

export interface DurationRules {
  baseMinutes: number;
  scaling?: {
    input: string;
    rate: number;
    freeUnits: number;
  };
}

export interface LineItem {
  label: string;
  amount: number; // pounds (not pence)
}

export interface PriceResult {
  total: number; // pounds
  breakdown: LineItem[];
}

// ── Evaluation ──

export function evaluatePrice(
  pricingRules: PricingRules,
  userInputs: Record<string, number | string | boolean>,
): PriceResult {
  const breakdown: LineItem[] = [];
  let total = pricingRules.basePrice;

  // Check if there's a fixedTier rule — it replaces basePrice
  const fixedTierRule = pricingRules.rules.find(
    (r): r is PricingRuleFixedTier => r.type === "fixedTier"
  );

  if (fixedTierRule) {
    // Find selected tier — look for a "tier" input or use the first tier's value matching any input
    const tierInput = userInputs["tier"] ?? userInputs["package"];
    const selectedTier = fixedTierRule.tiers.find(
      (t) => String(t.value) === String(tierInput)
    );
    if (selectedTier) {
      total = selectedTier.price;
      breakdown.push({ label: selectedTier.label, amount: selectedTier.price });
    } else {
      // Default to first tier
      const first = fixedTierRule.tiers[0];
      if (first) {
        total = first.price;
        breakdown.push({ label: first.label, amount: first.price });
      }
    }
  } else {
    breakdown.push({ label: "Base price", amount: pricingRules.basePrice });
  }

  // Apply perUnit rules
  for (const rule of pricingRules.rules) {
    if (rule.type === "perUnit") {
      const inputVal = Number(userInputs[rule.input] ?? 0);
      const extra = Math.max(0, inputVal - rule.freeUnits);
      const amount = extra * rule.rate;
      if (amount > 0) {
        total += amount;
        breakdown.push({
          label: `+£${rule.rate} per ${rule.input} above ${rule.freeUnits}`,
          amount,
        });
      }
    }
  }

  // Apply bulkDiscount rules
  for (const rule of pricingRules.rules) {
    if (rule.type === "bulkDiscount") {
      const inputVal = Number(userInputs[rule.input] ?? 0);
      if (inputVal >= rule.threshold) {
        const discountAmount = total * (rule.percent / 100);
        total -= discountAmount;
        breakdown.push({
          label: `${rule.percent}% bulk discount`,
          amount: -discountAmount,
        });
      }
    }
  }

  // Round to 2 decimal places
  total = Math.round(total * 100) / 100;

  return { total, breakdown };
}

export function evaluateDuration(
  durationRules: DurationRules,
  userInputs: Record<string, number | string | boolean>,
): number {
  let mins = durationRules.baseMinutes;
  if (durationRules.scaling) {
    const { input, rate, freeUnits } = durationRules.scaling;
    const inputVal = Number(userInputs[input] ?? 0);
    mins += Math.max(0, inputVal - freeUnits) * rate;
  }
  return mins;
}

export function validateInputs(
  inputFields: InputField[],
  userInputs: Record<string, number | string | boolean>,
  pricingRules: PricingRules,
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of inputFields) {
    const val = userInputs[field.key];

    if (field.type === "number") {
      const numVal = Number(val ?? field.default ?? 0);
      if (field.min !== undefined && numVal < field.min) {
        errors[field.key] = `Minimum is ${field.min}`;
      }
      if (field.max !== undefined && numVal > field.max) {
        errors[field.key] = `Maximum is ${field.max}`;
      }
    }

    if (field.type === "select") {
      const strVal = String(val ?? field.default ?? "");
      const validOptions = field.options.map((o) => String(o.value));
      if (!validOptions.includes(strVal)) {
        errors[field.key] = `Invalid selection`;
      }
    }
  }

  // Check minimum rules from pricing
  for (const rule of pricingRules.rules) {
    if (rule.type === "minimum") {
      const numVal = Number(userInputs[rule.input] ?? 0);
      if (numVal < rule.minValue) {
        errors[rule.input] = `Minimum ${rule.minValue}`;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// ── Multi-property discount (system-level) ──

const MULTI_PROPERTY_DISCOUNT = 15;

export function calcMultiPropertyDiscount(propertyCount: number): number {
  if (propertyCount <= 1) return 0;
  return (propertyCount - 1) * MULTI_PROPERTY_DISCOUNT;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit src/lib/pricing-engine.ts 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pricing-engine.ts
git commit -m "feat: add pricing engine with rule evaluation functions"
```

---

## Task 3: Service Fetching & Resolution Layer

**Files:**
- Create: `src/lib/services.ts`

- [ ] **Step 1: Create the service resolution module**

```typescript
// src/lib/services.ts
import { db } from "@/lib/db";
import { services, serviceCategories, serviceBrandOverrides } from "@/lib/schema";
import { eq, asc } from "drizzle-orm";
import type { BrandMode } from "@/lib/brand";
import type { PricingRules, DurationRules, InputField } from "@/lib/pricing-engine";

export interface ResolvedService {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  pricingRules: PricingRules;
  durationRules: DurationRules;
  inputFields: InputField[];
  isAddon: boolean;
  parentServiceId: string | null;
  sortOrder: number;
}

export interface ResolvedCategory {
  id: string;
  name: string;
  sortOrder: number;
  services: ResolvedService[];
}

export async function getServicesForBrand(brandMode: BrandMode): Promise<ResolvedCategory[]> {
  const allCategories = await db
    .select()
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder));

  const allServices = await db
    .select()
    .from(services)
    .where(eq(services.visible, 1))
    .orderBy(asc(services.sortOrder));

  const allOverrides = await db
    .select()
    .from(serviceBrandOverrides)
    .where(eq(serviceBrandOverrides.brandMode, brandMode));

  const overrideMap = new Map(
    allOverrides.map((o) => [o.serviceId, o])
  );

  const resolved: ResolvedService[] = [];

  for (const svc of allServices) {
    const override = overrideMap.get(svc.id);

    // If there's an override with visible=0, skip this service
    if (override && !override.visible) continue;

    const catRow = allCategories.find((c) => c.id === svc.categoryId);

    resolved.push({
      id: svc.id,
      categoryId: svc.categoryId,
      categoryName: catRow?.name ?? "Other",
      name: svc.name,
      description: svc.description,
      pricingRules: JSON.parse(override?.pricingRules ?? svc.pricingRules) as PricingRules,
      durationRules: JSON.parse(override?.durationRules ?? svc.durationRules) as DurationRules,
      inputFields: JSON.parse(override?.inputFields ?? svc.inputFields) as InputField[],
      isAddon: !!svc.isAddon,
      parentServiceId: svc.parentServiceId,
      sortOrder: svc.sortOrder,
    });
  }

  // Group by category
  const categories: ResolvedCategory[] = allCategories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      sortOrder: cat.sortOrder,
      services: resolved.filter((s) => s.categoryId === cat.id),
    }))
    .filter((cat) => cat.services.length > 0);

  return categories;
}

export async function getServiceById(serviceId: string, brandMode: BrandMode): Promise<ResolvedService | null> {
  const [svc] = await db
    .select()
    .from(services)
    .where(eq(services.id, serviceId))
    .limit(1);

  if (!svc) return null;

  const [override] = await db
    .select()
    .from(serviceBrandOverrides)
    .where(eq(serviceBrandOverrides.serviceId, serviceId))
    .limit(1);

  const brandOverride = override?.brandMode === brandMode ? override : null;

  const [catRow] = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.id, svc.categoryId))
    .limit(1);

  return {
    id: svc.id,
    categoryId: svc.categoryId,
    categoryName: catRow?.name ?? "Other",
    name: svc.name,
    description: svc.description,
    pricingRules: JSON.parse(brandOverride?.pricingRules ?? svc.pricingRules) as PricingRules,
    durationRules: JSON.parse(brandOverride?.durationRules ?? svc.durationRules) as DurationRules,
    inputFields: JSON.parse(brandOverride?.inputFields ?? svc.inputFields) as InputField[],
    isAddon: !!svc.isAddon,
    parentServiceId: svc.parentServiceId,
    sortOrder: svc.sortOrder,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services.ts
git commit -m "feat: add service resolution layer with brand override support"
```

---

## Task 4: Seed Migration — Convert Existing Services to DB Records

**Files:**
- Create: `src/lib/seed-services.ts`

- [ ] **Step 1: Create the seed script**

This script translates every current hardcoded service into the new JSON rule format and inserts it into the database. It's idempotent — checks if services already exist.

```typescript
// src/lib/seed-services.ts
import { db } from "@/lib/db";
import { serviceCategories, services } from "@/lib/schema";

const CATEGORIES = [
  { id: "cat-photography", name: "Photography", sortOrder: 0 },
  { id: "cat-video", name: "Video", sortOrder: 1 },
  { id: "cat-floorplans", name: "Floor Plans", sortOrder: 2 },
];

const SERVICES = [
  // ── Photography ──
  {
    id: "svc-photography",
    categoryId: "cat-photography",
    name: "Photography",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 0,
      rules: [
        { type: "perUnit", input: "photos", rate: 6.5, freeUnits: 0 },
        { type: "minimum", input: "photos", minValue: 20 },
        { type: "bulkDiscount", input: "photos", threshold: 100, percent: 10 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 40,
      scaling: { input: "photos", rate: 5, freeUnits: 20 },
    }),
    inputFields: JSON.stringify([
      { key: "photos", label: "Number of Photos", type: "number", min: 20, max: 500, default: 20 },
    ]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 0,
    visible: 1,
  },
  {
    id: "svc-drone-photography",
    categoryId: "cat-photography",
    name: "Drone Photography",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 0,
      rules: [
        { type: "fixedTier", tiers: [
          { label: "8 photos — £75", value: "8", price: 75 },
          { label: "20 photos — £140", value: "20", price: 140 },
        ]},
      ],
    }),
    durationRules: JSON.stringify({ baseMinutes: 25 }),
    inputFields: JSON.stringify([
      { key: "package", label: "Package", type: "select", options: [
        { value: "8", label: "8 photos — £75" },
        { value: "20", label: "20 photos — £140" },
      ], default: "8" },
    ]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 1,
    visible: 1,
  },

  // ── Video ──
  {
    id: "svc-standard-video",
    categoryId: "cat-video",
    name: "Unpresented Property Video",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 100,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 40,
      scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 0,
    visible: 1,
  },
  {
    id: "svc-standard-video-drone",
    categoryId: "cat-video",
    name: "Drone Footage",
    description: "Add drone footage to Unpresented Video",
    pricingRules: JSON.stringify({ basePrice: 65, rules: [{ type: "flatRate" }] }),
    durationRules: JSON.stringify({ baseMinutes: 25 }),
    inputFields: JSON.stringify([]),
    isAddon: 1,
    parentServiceId: "svc-standard-video",
    sortOrder: 1,
    visible: 1,
  },
  {
    id: "svc-agent-presented-video",
    categoryId: "cat-video",
    name: "Agent Presented Video",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 225,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 45, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 105,
      scaling: { input: "bedrooms", rate: 10, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 2,
    visible: 1,
  },
  {
    id: "svc-agent-presented-video-drone",
    categoryId: "cat-video",
    name: "Drone Footage",
    description: "Add drone footage to Agent Presented Video",
    pricingRules: JSON.stringify({ basePrice: 65, rules: [{ type: "flatRate" }] }),
    durationRules: JSON.stringify({ baseMinutes: 25 }),
    inputFields: JSON.stringify([]),
    isAddon: 1,
    parentServiceId: "svc-agent-presented-video",
    sortOrder: 3,
    visible: 1,
  },
  {
    id: "svc-social-media-video",
    categoryId: "cat-video",
    name: "Social Media Video (Unpresented)",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 100,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 25, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 25,
      scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 4,
    visible: 1,
  },
  {
    id: "svc-social-media-presented-video",
    categoryId: "cat-video",
    name: "Social Media Video (Presented)",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 200,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 30, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 60,
      scaling: { input: "bedrooms", rate: 10, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 5,
    visible: 1,
  },

  // ── Floor Plans ──
  {
    id: "svc-standard-floor-plan",
    categoryId: "cat-floorplans",
    name: "Standard Floor Plan",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 60,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 25,
      scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 0,
    visible: 1,
  },
  {
    id: "svc-premium-floor-plan",
    categoryId: "cat-floorplans",
    name: "Premium Floor Plan",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 80,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      basePrice: 80,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 25,
      scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 1,
    visible: 1,
  },
  {
    id: "svc-3d-floor-plan",
    categoryId: "cat-floorplans",
    name: "3D Floor Plan",
    description: null,
    pricingRules: JSON.stringify({
      basePrice: 150,
      rules: [
        { type: "perUnit", input: "bedrooms", rate: 20, freeUnits: 2 },
      ],
    }),
    durationRules: JSON.stringify({
      baseMinutes: 25,
      scaling: { input: "bedrooms", rate: 5, freeUnits: 2 },
    }),
    inputFields: JSON.stringify([]),
    isAddon: 0,
    parentServiceId: null,
    sortOrder: 2,
    visible: 1,
  },
];

export async function seedServices() {
  // Check if already seeded
  const existing = await db.select({ id: serviceCategories.id }).from(serviceCategories).limit(1);
  if (existing.length > 0) {
    console.log("Services already seeded, skipping.");
    return;
  }

  // Insert categories
  for (const cat of CATEGORIES) {
    await db.insert(serviceCategories).values(cat);
  }

  // Insert services
  for (const svc of SERVICES) {
    await db.insert(services).values(svc);
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${SERVICES.length} services.`);
}
```

- [ ] **Step 2: Create a runnable script entry point**

Create a small script that can be run via `npx tsx`:

```typescript
// scripts/seed-services.ts
import { seedServices } from "../src/lib/seed-services";

seedServices()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
```

- [ ] **Step 3: Run the seed**

```bash
npx tsx scripts/seed-services.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/seed-services.ts scripts/seed-services.ts
git commit -m "feat: add seed script for existing services migration"
```

---

## Task 5: Public Services API

**Files:**
- Create: `src/app/api/services/route.ts`

- [ ] **Step 1: Create the public endpoint**

```typescript
// src/app/api/services/route.ts
import { NextResponse } from "next/server";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand");
  const brandMode = brand === "whitelabel" ? "whitelabel" : brand === "main" ? "main" : getBrandMode();

  const categories = await getServicesForBrand(brandMode);
  return NextResponse.json(categories);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/services/route.ts
git commit -m "feat: add public /api/services endpoint with brand resolution"
```

---

## Task 6: Admin Service Categories API

**Files:**
- Create: `src/app/api/admin/service-categories/route.ts`
- Create: `src/app/api/admin/service-categories/[id]/route.ts`

- [ ] **Step 1: Create the categories list/create endpoint**

```typescript
// src/app/api/admin/service-categories/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceCategories } from "@/lib/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const cats = await db
    .select()
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder));
  return NextResponse.json(cats);
}

export async function POST(request: Request) {
  try {
    const { name, sortOrder } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await db.insert(serviceCategories).values({
      id,
      name: name.trim(),
      sortOrder: sortOrder ?? 0,
    });
    return NextResponse.json({ id, name: name.trim() }, { status: 201 });
  } catch (err) {
    console.error("Create category error:", err);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the category update/delete endpoint**

```typescript
// src/app/api/admin/service-categories/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serviceCategories, services } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

    await db.update(serviceCategories).set(updates).where(eq(serviceCategories.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update category error:", err);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Check if category has services
  const svcCount = await db
    .select({ id: services.id })
    .from(services)
    .where(eq(services.categoryId, id))
    .limit(1);

  if (svcCount.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete category with services. Move or delete services first." },
      { status: 400 }
    );
  }

  await db.delete(serviceCategories).where(eq(serviceCategories.id, id));
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/service-categories/
git commit -m "feat: add admin service categories API (CRUD)"
```

---

## Task 7: Admin Services API

**Files:**
- Create: `src/app/api/admin/services/route.ts`
- Create: `src/app/api/admin/services/[id]/route.ts`

- [ ] **Step 1: Create the services list/create endpoint**

```typescript
// src/app/api/admin/services/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services, serviceCategories, serviceBrandOverrides } from "@/lib/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const allServices = await db
    .select()
    .from(services)
    .orderBy(asc(services.sortOrder));

  const allCategories = await db
    .select()
    .from(serviceCategories)
    .orderBy(asc(serviceCategories.sortOrder));

  const allOverrides = await db.select().from(serviceBrandOverrides);

  // Group overrides by serviceId
  const overridesByService = new Map<string, typeof allOverrides>();
  for (const o of allOverrides) {
    const existing = overridesByService.get(o.serviceId) ?? [];
    existing.push(o);
    overridesByService.set(o.serviceId, existing);
  }

  const result = allCategories.map((cat) => ({
    ...cat,
    services: allServices
      .filter((s) => s.categoryId === cat.id)
      .map((s) => ({
        ...s,
        pricingRules: JSON.parse(s.pricingRules),
        durationRules: JSON.parse(s.durationRules),
        inputFields: JSON.parse(s.inputFields),
        overrides: (overridesByService.get(s.id) ?? []).map((o) => ({
          ...o,
          pricingRules: o.pricingRules ? JSON.parse(o.pricingRules) : null,
          durationRules: o.durationRules ? JSON.parse(o.durationRules) : null,
          inputFields: o.inputFields ? JSON.parse(o.inputFields) : null,
        })),
      })),
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, categoryId, description, pricingRules, durationRules, inputFields, isAddon, parentServiceId, sortOrder } = body;

    if (!name?.trim() || !categoryId) {
      return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await db.insert(services).values({
      id,
      categoryId,
      name: name.trim(),
      description: description || null,
      pricingRules: JSON.stringify(pricingRules),
      durationRules: JSON.stringify(durationRules),
      inputFields: JSON.stringify(inputFields ?? []),
      isAddon: isAddon ? 1 : 0,
      parentServiceId: parentServiceId || null,
      sortOrder: sortOrder ?? 0,
      visible: 1,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    console.error("Create service error:", err);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the service update/delete endpoint**

```typescript
// src/app/api/admin/services/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { services, serviceBrandOverrides } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Handle brand override updates
    if (body.brandOverride) {
      const { brandMode, visible, pricingRules, durationRules, inputFields } = body.brandOverride;

      // Check if override exists
      const [existing] = await db
        .select()
        .from(serviceBrandOverrides)
        .where(
          and(
            eq(serviceBrandOverrides.serviceId, id),
            eq(serviceBrandOverrides.brandMode, brandMode)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .update(serviceBrandOverrides)
          .set({
            visible: visible ? 1 : 0,
            pricingRules: pricingRules ? JSON.stringify(pricingRules) : null,
            durationRules: durationRules ? JSON.stringify(durationRules) : null,
            inputFields: inputFields ? JSON.stringify(inputFields) : null,
          })
          .where(eq(serviceBrandOverrides.id, existing.id));
      } else {
        await db.insert(serviceBrandOverrides).values({
          id: crypto.randomUUID(),
          serviceId: id,
          brandMode,
          visible: visible ? 1 : 0,
          pricingRules: pricingRules ? JSON.stringify(pricingRules) : null,
          durationRules: durationRules ? JSON.stringify(durationRules) : null,
          inputFields: inputFields ? JSON.stringify(inputFields) : null,
        });
      }

      return NextResponse.json({ success: true });
    }

    // Handle removing a brand override
    if (body.removeBrandOverride) {
      const { brandMode } = body.removeBrandOverride;
      await db
        .delete(serviceBrandOverrides)
        .where(
          and(
            eq(serviceBrandOverrides.serviceId, id),
            eq(serviceBrandOverrides.brandMode, brandMode)
          )
        );
      return NextResponse.json({ success: true });
    }

    // Regular service update
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.description !== undefined) updates.description = body.description || null;
    if (body.pricingRules !== undefined) updates.pricingRules = JSON.stringify(body.pricingRules);
    if (body.durationRules !== undefined) updates.durationRules = JSON.stringify(body.durationRules);
    if (body.inputFields !== undefined) updates.inputFields = JSON.stringify(body.inputFields);
    if (body.isAddon !== undefined) updates.isAddon = body.isAddon ? 1 : 0;
    if (body.parentServiceId !== undefined) updates.parentServiceId = body.parentServiceId || null;
    if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;
    if (body.visible !== undefined) updates.visible = body.visible ? 1 : 0;
    updates.updatedAt = new Date().toISOString();

    await db.update(services).set(updates).where(eq(services.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update service error:", err);
    return NextResponse.json({ error: "Failed to update service" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    // Delete overrides first
    await db.delete(serviceBrandOverrides).where(eq(serviceBrandOverrides.serviceId, id));
    // Delete the service
    await db.delete(services).where(eq(services.id, id));
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete service error:", err);
    return NextResponse.json({ error: "Failed to delete service" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/services/
git commit -m "feat: add admin services API with brand override support"
```

---

## Task 8: Admin Nav — Add Services Link

**Files:**
- Modify: `src/app/admin/components/AdminNav.tsx`

- [ ] **Step 1: Add Services link between Discounts and Videos**

In `src/app/admin/components/AdminNav.tsx`, after the Discounts link (line 44), add:

```tsx
<Link
  href="/admin/services"
  className={`${styles.link} ${pathname?.startsWith('/admin/services') ? styles.active : ''}`}
>
  Services
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/components/AdminNav.tsx
git commit -m "feat: add Services link to admin navigation"
```

---

## Task 9: Admin Services Page — UI

**Files:**
- Create: `src/app/admin/services/page.tsx`
- Create: `src/app/admin/services/page.module.css`

- [ ] **Step 1: Create the admin services page**

This is a large component. It shows categories with their services, allows CRUD operations, and includes the pricing rules editor. Follow the existing admin page patterns (see `src/app/admin/discounts/page.tsx`).

```typescript
// src/app/admin/services/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface InputField {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  min?: number;
  max?: number;
  default?: number | string | boolean;
  options?: { value: string | number; label: string }[];
}

interface PricingRule {
  type: string;
  input?: string;
  rate?: number;
  freeUnits?: number;
  threshold?: number;
  percent?: number;
  minValue?: number;
  tiers?: { label: string; value: string | number; price: number }[];
}

interface PricingRules {
  basePrice: number;
  rules: PricingRule[];
}

interface DurationRules {
  baseMinutes: number;
  scaling?: { input: string; rate: number; freeUnits: number };
}

interface BrandOverride {
  id: string;
  brandMode: string;
  visible: number;
  pricingRules: PricingRules | null;
  durationRules: DurationRules | null;
  inputFields: InputField[] | null;
}

interface Service {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  pricingRules: PricingRules;
  durationRules: DurationRules;
  inputFields: InputField[];
  isAddon: number;
  parentServiceId: string | null;
  sortOrder: number;
  visible: number;
  overrides: BrandOverride[];
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  services: Service[];
}

// ── Pricing Rule Editor Sub-Component ──
function PricingRulesEditor({
  rules,
  onChange,
  availableInputs,
}: {
  rules: PricingRules;
  onChange: (r: PricingRules) => void;
  availableInputs: string[];
}) {
  const hasFixedTier = rules.rules.some((r) => r.type === "fixedTier");
  const pricingType = hasFixedTier ? "fixedTier" : rules.rules.some((r) => r.type === "perUnit") ? "perUnit" : "flat";

  const setPricingType = (type: string) => {
    const otherRules = rules.rules.filter((r) => r.type !== "perUnit" && r.type !== "fixedTier" && r.type !== "flatRate");
    if (type === "flat") {
      onChange({ ...rules, rules: [...otherRules, { type: "flatRate" }] });
    } else if (type === "perUnit") {
      onChange({ ...rules, rules: [...otherRules, { type: "perUnit", input: availableInputs[0] || "bedrooms", rate: 0, freeUnits: 0 }] });
    } else if (type === "fixedTier") {
      onChange({ ...rules, rules: [...otherRules, { type: "fixedTier", tiers: [{ label: "Option 1", value: "1", price: 0 }] }] });
    }
  };

  const perUnitRule = rules.rules.find((r) => r.type === "perUnit");
  const fixedTierRule = rules.rules.find((r) => r.type === "fixedTier");
  const bulkDiscountRule = rules.rules.find((r) => r.type === "bulkDiscount");
  const minimumRule = rules.rules.find((r) => r.type === "minimum");

  const updateRule = (index: number, updates: Partial<PricingRule>) => {
    const newRules = [...rules.rules];
    newRules[index] = { ...newRules[index], ...updates };
    onChange({ ...rules, rules: newRules });
  };

  const toggleModifier = (type: "bulkDiscount" | "minimum", enabled: boolean) => {
    if (enabled) {
      const newRule: PricingRule = type === "bulkDiscount"
        ? { type: "bulkDiscount", input: availableInputs[0] || "bedrooms", threshold: 0, percent: 0 }
        : { type: "minimum", input: availableInputs[0] || "bedrooms", minValue: 0 };
      onChange({ ...rules, rules: [...rules.rules, newRule] });
    } else {
      onChange({ ...rules, rules: rules.rules.filter((r) => r.type !== type) });
    }
  };

  return (
    <div className={styles.pricingEditor}>
      <div className={styles.editorRow}>
        <label className={styles.editorLabel}>
          <span>Base Price (£)</span>
          <input
            className={styles.editorInput}
            type="number"
            step="0.01"
            min="0"
            value={rules.basePrice}
            onChange={(e) => onChange({ ...rules, basePrice: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className={styles.editorRow}>
        <label className={styles.editorLabel}>
          <span>Pricing Type</span>
          <select
            className={styles.editorInput}
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}
          >
            <option value="flat">Fixed price</option>
            <option value="perUnit">Scales with input</option>
            <option value="fixedTier">Tiered options</option>
          </select>
        </label>
      </div>

      {pricingType === "perUnit" && perUnitRule && (
        <div className={styles.editorRow}>
          <span className={styles.editorPrefix}>+£</span>
          <input
            className={styles.editorInputSm}
            type="number"
            step="0.01"
            value={perUnitRule.rate ?? 0}
            onChange={(e) => {
              const idx = rules.rules.indexOf(perUnitRule);
              updateRule(idx, { rate: Number(e.target.value) });
            }}
          />
          <span className={styles.editorPrefix}>per</span>
          <select
            className={styles.editorInputSm}
            value={perUnitRule.input ?? ""}
            onChange={(e) => {
              const idx = rules.rules.indexOf(perUnitRule);
              updateRule(idx, { input: e.target.value });
            }}
          >
            {availableInputs.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
            <option value="bedrooms">bedrooms</option>
          </select>
          <span className={styles.editorPrefix}>above</span>
          <input
            className={styles.editorInputSm}
            type="number"
            value={perUnitRule.freeUnits ?? 0}
            onChange={(e) => {
              const idx = rules.rules.indexOf(perUnitRule);
              updateRule(idx, { freeUnits: Number(e.target.value) });
            }}
          />
        </div>
      )}

      {pricingType === "fixedTier" && fixedTierRule && (
        <div className={styles.tierEditor}>
          {(fixedTierRule.tiers ?? []).map((tier, ti) => (
            <div key={ti} className={styles.tierRow}>
              <input
                className={styles.editorInput}
                type="text"
                value={tier.label}
                placeholder="Label"
                onChange={(e) => {
                  const idx = rules.rules.indexOf(fixedTierRule);
                  const newTiers = [...(fixedTierRule.tiers ?? [])];
                  newTiers[ti] = { ...newTiers[ti], label: e.target.value };
                  updateRule(idx, { tiers: newTiers });
                }}
              />
              <input
                className={styles.editorInputSm}
                type="text"
                value={String(tier.value)}
                placeholder="Value"
                onChange={(e) => {
                  const idx = rules.rules.indexOf(fixedTierRule);
                  const newTiers = [...(fixedTierRule.tiers ?? [])];
                  newTiers[ti] = { ...newTiers[ti], value: e.target.value };
                  updateRule(idx, { tiers: newTiers });
                }}
              />
              <span className={styles.editorPrefix}>£</span>
              <input
                className={styles.editorInputSm}
                type="number"
                step="0.01"
                value={tier.price}
                onChange={(e) => {
                  const idx = rules.rules.indexOf(fixedTierRule);
                  const newTiers = [...(fixedTierRule.tiers ?? [])];
                  newTiers[ti] = { ...newTiers[ti], price: Number(e.target.value) };
                  updateRule(idx, { tiers: newTiers });
                }}
              />
              <button
                className={styles.removeTierBtn}
                onClick={() => {
                  const idx = rules.rules.indexOf(fixedTierRule);
                  const newTiers = (fixedTierRule.tiers ?? []).filter((_, i) => i !== ti);
                  updateRule(idx, { tiers: newTiers });
                }}
              >
                x
              </button>
            </div>
          ))}
          <button
            className={styles.addTierBtn}
            onClick={() => {
              const idx = rules.rules.indexOf(fixedTierRule);
              const newTiers = [...(fixedTierRule.tiers ?? []), { label: "", value: "", price: 0 }];
              updateRule(idx, { tiers: newTiers });
            }}
          >
            + Add tier
          </button>
        </div>
      )}

      <div className={styles.modifiers}>
        <label className={styles.modifierCheck}>
          <input
            type="checkbox"
            checked={!!bulkDiscountRule}
            onChange={(e) => toggleModifier("bulkDiscount", e.target.checked)}
          />
          <span>Bulk discount</span>
        </label>
        {bulkDiscountRule && (
          <div className={styles.editorRow}>
            <input
              className={styles.editorInputSm}
              type="number"
              value={bulkDiscountRule.percent ?? 0}
              onChange={(e) => {
                const idx = rules.rules.indexOf(bulkDiscountRule);
                updateRule(idx, { percent: Number(e.target.value) });
              }}
            />
            <span className={styles.editorPrefix}>% off when</span>
            <select
              className={styles.editorInputSm}
              value={bulkDiscountRule.input ?? ""}
              onChange={(e) => {
                const idx = rules.rules.indexOf(bulkDiscountRule);
                updateRule(idx, { input: e.target.value });
              }}
            >
              {availableInputs.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
              <option value="bedrooms">bedrooms</option>
            </select>
            <span className={styles.editorPrefix}>is</span>
            <input
              className={styles.editorInputSm}
              type="number"
              value={bulkDiscountRule.threshold ?? 0}
              onChange={(e) => {
                const idx = rules.rules.indexOf(bulkDiscountRule);
                updateRule(idx, { threshold: Number(e.target.value) });
              }}
            />
            <span className={styles.editorPrefix}>or more</span>
          </div>
        )}

        <label className={styles.modifierCheck}>
          <input
            type="checkbox"
            checked={!!minimumRule}
            onChange={(e) => toggleModifier("minimum", e.target.checked)}
          />
          <span>Minimum quantity</span>
        </label>
        {minimumRule && (
          <div className={styles.editorRow}>
            <select
              className={styles.editorInputSm}
              value={minimumRule.input ?? ""}
              onChange={(e) => {
                const idx = rules.rules.indexOf(minimumRule);
                updateRule(idx, { input: e.target.value });
              }}
            >
              {availableInputs.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <span className={styles.editorPrefix}>must be at least</span>
            <input
              className={styles.editorInputSm}
              type="number"
              value={minimumRule.minValue ?? 0}
              onChange={(e) => {
                const idx = rules.rules.indexOf(minimumRule);
                updateRule(idx, { minValue: Number(e.target.value) });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──
export default function ServicesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [creatingInCategory, setCreatingInCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newServiceName, setNewServiceName] = useState("");
  const [saving, setSaving] = useState(false);
  const [brandTab, setBrandTab] = useState<"default" | "main" | "whitelabel">("default");

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/services");
    setCategories(await res.json());
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    await fetch("/api/admin/service-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName, sortOrder: categories.length }),
    });
    setNewCategoryName("");
    fetchData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/admin/service-categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Failed to delete");
      return;
    }
    fetchData();
  };

  const handleCreateService = async (categoryId: string) => {
    if (!newServiceName.trim()) return;
    await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newServiceName,
        categoryId,
        pricingRules: { basePrice: 0, rules: [{ type: "flatRate" }] },
        durationRules: { baseMinutes: 30 },
        inputFields: [],
        sortOrder: categories.find((c) => c.id === categoryId)?.services.length ?? 0,
      }),
    });
    setNewServiceName("");
    setCreatingInCategory(null);
    fetchData();
  };

  const startEditing = (svc: Service) => {
    setEditingServiceId(svc.id);
    setEditingService({ ...svc });
    setBrandTab("default");
  };

  const handleSaveService = async () => {
    if (!editingService || !editingServiceId) return;
    setSaving(true);
    try {
      if (brandTab === "default") {
        await fetch(`/api/admin/services/${editingServiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingService.name,
            description: editingService.description,
            categoryId: editingService.categoryId,
            pricingRules: editingService.pricingRules,
            durationRules: editingService.durationRules,
            inputFields: editingService.inputFields,
            isAddon: editingService.isAddon,
            parentServiceId: editingService.parentServiceId,
          }),
        });
      } else {
        const override = editingService.overrides.find((o) => o.brandMode === brandTab);
        await fetch(`/api/admin/services/${editingServiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandOverride: {
              brandMode: brandTab,
              visible: override?.visible ?? 1,
              pricingRules: override?.pricingRules ?? null,
              durationRules: override?.durationRules ?? null,
              inputFields: override?.inputFields ?? null,
            },
          }),
        });
      }
      setEditingServiceId(null);
      setEditingService(null);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisible = async (svc: Service) => {
    await fetch(`/api/admin/services/${svc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: svc.visible ? 0 : 1 }),
    });
    fetchData();
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Delete this service? This cannot be undone.")) return;
    await fetch(`/api/admin/services/${id}`, { method: "DELETE" });
    fetchData();
  };

  const getAvailableInputKeys = (svc: Service | null): string[] => {
    if (!svc) return ["bedrooms"];
    return [...svc.inputFields.map((f) => f.key), "bedrooms"];
  };

  // Get current pricing/duration rules based on active brand tab
  const getActiveRules = () => {
    if (!editingService) return null;
    if (brandTab === "default") {
      return {
        pricingRules: editingService.pricingRules,
        durationRules: editingService.durationRules,
      };
    }
    const override = editingService.overrides.find((o) => o.brandMode === brandTab);
    return {
      pricingRules: override?.pricingRules ?? editingService.pricingRules,
      durationRules: override?.durationRules ?? editingService.durationRules,
    };
  };

  const setActiveRules = (pricingRules: PricingRules, durationRules: DurationRules) => {
    if (!editingService) return;
    if (brandTab === "default") {
      setEditingService({ ...editingService, pricingRules, durationRules });
    } else {
      const overrides = [...editingService.overrides];
      const idx = overrides.findIndex((o) => o.brandMode === brandTab);
      if (idx >= 0) {
        overrides[idx] = { ...overrides[idx], pricingRules, durationRules };
      } else {
        overrides.push({
          id: "",
          brandMode: brandTab,
          visible: 1,
          pricingRules,
          durationRules,
          inputFields: null,
        });
      }
      setEditingService({ ...editingService, overrides });
    }
  };

  const activeRules = getActiveRules();

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h2 className={styles.title}>Services & Pricing</h2>

          {categories.map((cat) => (
            <div key={cat.id} className={styles.categoryBlock}>
              <div className={styles.categoryHeader}>
                <h3 className={styles.categoryName}>{cat.name}</h3>
                <button
                  className={styles.deleteCatBtn}
                  onClick={() => handleDeleteCategory(cat.id)}
                >
                  Delete Category
                </button>
              </div>

              <div className={styles.serviceList}>
                {cat.services.map((svc) => (
                  <div key={svc.id}>
                    <div className={`${styles.serviceRow} ${!svc.visible ? styles.hidden : ""}`}>
                      <span className={styles.serviceName}>
                        {svc.isAddon ? "↳ " : ""}{svc.name}
                      </span>
                      <span className={styles.servicePrice}>
                        £{svc.pricingRules.basePrice}
                        {svc.pricingRules.rules.some((r) => r.type === "perUnit") && "+"}
                      </span>
                      <button
                        className={`${styles.toggleBtn} ${svc.visible ? styles.toggleActive : styles.toggleInactive}`}
                        onClick={() => handleToggleVisible(svc)}
                      >
                        {svc.visible ? "Visible" : "Hidden"}
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => editingServiceId === svc.id ? (setEditingServiceId(null), setEditingService(null)) : startEditing(svc)}
                      >
                        {editingServiceId === svc.id ? "Cancel" : "Edit"}
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDeleteService(svc.id)}
                      >
                        Delete
                      </button>
                    </div>

                    {editingServiceId === svc.id && editingService && activeRules && (
                      <div className={styles.editPanel}>
                        <div className={styles.brandTabs}>
                          {(["default", "main", "whitelabel"] as const).map((tab) => (
                            <button
                              key={tab}
                              className={`${styles.brandTab} ${brandTab === tab ? styles.brandTabActive : ""}`}
                              onClick={() => setBrandTab(tab)}
                            >
                              {tab === "default" ? "Default" : tab === "main" ? "Main Site" : "White Label"}
                            </button>
                          ))}
                        </div>

                        <div className={styles.editFields}>
                          {brandTab === "default" && (
                            <>
                              <label className={styles.editorLabel}>
                                <span>Name</span>
                                <input
                                  className={styles.editorInput}
                                  type="text"
                                  value={editingService.name}
                                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                                />
                              </label>
                              <label className={styles.editorLabel}>
                                <span>Description</span>
                                <input
                                  className={styles.editorInput}
                                  type="text"
                                  value={editingService.description ?? ""}
                                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value || null })}
                                />
                              </label>
                              <label className={styles.editorLabel}>
                                <span>Category</span>
                                <select
                                  className={styles.editorInput}
                                  value={editingService.categoryId}
                                  onChange={(e) => setEditingService({ ...editingService, categoryId: e.target.value })}
                                >
                                  {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </label>
                              <label className={styles.modifierCheck}>
                                <input
                                  type="checkbox"
                                  checked={!!editingService.isAddon}
                                  onChange={(e) => setEditingService({ ...editingService, isAddon: e.target.checked ? 1 : 0 })}
                                />
                                <span>Is add-on to another service</span>
                              </label>
                              {!!editingService.isAddon && (
                                <label className={styles.editorLabel}>
                                  <span>Parent Service</span>
                                  <select
                                    className={styles.editorInput}
                                    value={editingService.parentServiceId ?? ""}
                                    onChange={(e) => setEditingService({ ...editingService, parentServiceId: e.target.value || null })}
                                  >
                                    <option value="">None</option>
                                    {categories.flatMap((c) => c.services.filter((s) => !s.isAddon && s.id !== editingService.id).map((s) => (
                                      <option key={s.id} value={s.id}>{c.name} — {s.name}</option>
                                    )))}
                                  </select>
                                </label>
                              )}
                            </>
                          )}

                          <h4 className={styles.editorSectionTitle}>Pricing</h4>
                          <PricingRulesEditor
                            rules={activeRules.pricingRules}
                            onChange={(r) => setActiveRules(r, activeRules.durationRules)}
                            availableInputs={getAvailableInputKeys(editingService)}
                          />

                          <h4 className={styles.editorSectionTitle}>Duration</h4>
                          <div className={styles.editorRow}>
                            <label className={styles.editorLabel}>
                              <span>Base Minutes</span>
                              <input
                                className={styles.editorInput}
                                type="number"
                                value={activeRules.durationRules.baseMinutes}
                                onChange={(e) => setActiveRules(activeRules.pricingRules, { ...activeRules.durationRules, baseMinutes: Number(e.target.value) })}
                              />
                            </label>
                          </div>
                          <label className={styles.modifierCheck}>
                            <input
                              type="checkbox"
                              checked={!!activeRules.durationRules.scaling}
                              onChange={(e) => {
                                const dr = { ...activeRules.durationRules };
                                if (e.target.checked) {
                                  dr.scaling = { input: "bedrooms", rate: 5, freeUnits: 2 };
                                } else {
                                  delete dr.scaling;
                                }
                                setActiveRules(activeRules.pricingRules, dr);
                              }}
                            />
                            <span>Duration scales with input</span>
                          </label>
                          {activeRules.durationRules.scaling && (
                            <div className={styles.editorRow}>
                              <span className={styles.editorPrefix}>+</span>
                              <input
                                className={styles.editorInputSm}
                                type="number"
                                value={activeRules.durationRules.scaling.rate}
                                onChange={(e) => setActiveRules(activeRules.pricingRules, { ...activeRules.durationRules, scaling: { ...activeRules.durationRules.scaling!, rate: Number(e.target.value) } })}
                              />
                              <span className={styles.editorPrefix}>min per</span>
                              <select
                                className={styles.editorInputSm}
                                value={activeRules.durationRules.scaling.input}
                                onChange={(e) => setActiveRules(activeRules.pricingRules, { ...activeRules.durationRules, scaling: { ...activeRules.durationRules.scaling!, input: e.target.value } })}
                              >
                                {getAvailableInputKeys(editingService).map((k) => (
                                  <option key={k} value={k}>{k}</option>
                                ))}
                              </select>
                              <span className={styles.editorPrefix}>above</span>
                              <input
                                className={styles.editorInputSm}
                                type="number"
                                value={activeRules.durationRules.scaling.freeUnits}
                                onChange={(e) => setActiveRules(activeRules.pricingRules, { ...activeRules.durationRules, scaling: { ...activeRules.durationRules.scaling!, freeUnits: Number(e.target.value) } })}
                              />
                            </div>
                          )}

                          {brandTab === "default" && (
                            <>
                              <h4 className={styles.editorSectionTitle}>Custom Input Fields</h4>
                              {editingService.inputFields.map((field, fi) => (
                                <div key={fi} className={styles.inputFieldRow}>
                                  <input
                                    className={styles.editorInputSm}
                                    type="text"
                                    value={field.key}
                                    placeholder="Key"
                                    onChange={(e) => {
                                      const fields = [...editingService.inputFields];
                                      fields[fi] = { ...fields[fi], key: e.target.value };
                                      setEditingService({ ...editingService, inputFields: fields });
                                    }}
                                  />
                                  <input
                                    className={styles.editorInput}
                                    type="text"
                                    value={field.label}
                                    placeholder="Label"
                                    onChange={(e) => {
                                      const fields = [...editingService.inputFields];
                                      fields[fi] = { ...fields[fi], label: e.target.value };
                                      setEditingService({ ...editingService, inputFields: fields });
                                    }}
                                  />
                                  <select
                                    className={styles.editorInputSm}
                                    value={field.type}
                                    onChange={(e) => {
                                      const fields = [...editingService.inputFields];
                                      fields[fi] = { ...fields[fi], type: e.target.value as "number" | "select" | "boolean" };
                                      setEditingService({ ...editingService, inputFields: fields });
                                    }}
                                  >
                                    <option value="number">Number</option>
                                    <option value="select">Select</option>
                                    <option value="boolean">Checkbox</option>
                                  </select>
                                  <button
                                    className={styles.removeTierBtn}
                                    onClick={() => {
                                      const fields = editingService.inputFields.filter((_, i) => i !== fi);
                                      setEditingService({ ...editingService, inputFields: fields });
                                    }}
                                  >
                                    x
                                  </button>
                                </div>
                              ))}
                              <button
                                className={styles.addTierBtn}
                                onClick={() => {
                                  const fields = [...editingService.inputFields, { key: "", label: "", type: "number" as const }];
                                  setEditingService({ ...editingService, inputFields: fields });
                                }}
                              >
                                + Add input field
                              </button>
                            </>
                          )}
                        </div>

                        <button className={styles.saveBtn} onClick={handleSaveService} disabled={saving}>
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {creatingInCategory === cat.id ? (
                  <div className={styles.createServiceRow}>
                    <input
                      className={styles.editorInput}
                      type="text"
                      placeholder="Service name"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleCreateService(cat.id)}
                    />
                    <button className={styles.createBtn} onClick={() => handleCreateService(cat.id)}>
                      Create
                    </button>
                    <button className={styles.editBtn} onClick={() => { setCreatingInCategory(null); setNewServiceName(""); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className={styles.addServiceBtn} onClick={() => setCreatingInCategory(cat.id)}>
                    + Add Service
                  </button>
                )}
              </div>
            </div>
          ))}

          <div className={styles.createCategoryRow}>
            <input
              className={styles.editorInput}
              type="text"
              placeholder="New category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCategory()}
            />
            <button className={styles.createBtn} onClick={handleCreateCategory}>
              Create Category
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create the styles**

```css
/* src/app/admin/services/page.module.css */
.main { padding: 2rem; }
.container { max-width: 1000px; margin: 0 auto; }
.title {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 2rem;
}

/* Category blocks */
.categoryBlock { margin-bottom: 2rem; border: 1px solid var(--color-border); }
.categoryHeader {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  background: rgba(0,0,0,0.02);
}
.categoryName {
  font-family: var(--font-body);
  font-size: 0.75rem; font-weight: 600;
  letter-spacing: 0.15em; text-transform: uppercase;
}
.deleteCatBtn {
  font-family: var(--font-body);
  font-size: 0.65rem; font-weight: 600;
  letter-spacing: 0.05em; text-transform: uppercase;
  border: 1px solid #c0392b; background: transparent; color: #c0392b;
  padding: 0.25rem 0.5rem; cursor: pointer; transition: all 0.15s ease;
}
.deleteCatBtn:hover { background: #c0392b; color: white; }

/* Service list */
.serviceList { }
.serviceRow {
  display: grid;
  grid-template-columns: 1fr 80px 80px 60px 60px;
  gap: 0.75rem; align-items: center;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
}
.serviceRow.hidden { opacity: 0.4; }
.serviceName { font-weight: 500; }
.servicePrice { color: var(--color-muted); font-size: 0.8rem; }

/* Buttons */
.toggleBtn {
  padding: 0.2rem 0.5rem;
  font-family: var(--font-body); font-size: 0.65rem;
  font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  border: 1px solid; cursor: pointer; transition: all 0.15s ease;
}
.toggleActive { border-color: #2d7a3a; color: #2d7a3a; background: transparent; }
.toggleActive:hover { background: #2d7a3a; color: white; }
.toggleInactive { border-color: #c0392b; color: #c0392b; background: transparent; }
.toggleInactive:hover { background: #c0392b; color: white; }

.editBtn, .deleteBtn {
  padding: 0.2rem 0.5rem;
  font-family: var(--font-body); font-size: 0.65rem;
  font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  border: 1px solid var(--color-border); background: transparent;
  color: var(--color-muted); cursor: pointer; transition: all 0.15s ease;
}
.editBtn:hover, .deleteBtn:hover { border-color: var(--color-text); color: var(--color-text); }

.addServiceBtn {
  display: block; width: 100%;
  padding: 0.6rem 1rem; text-align: left;
  font-family: var(--font-body); font-size: 0.8rem;
  color: var(--color-muted); background: transparent; border: none; cursor: pointer;
}
.addServiceBtn:hover { color: var(--color-text); }

/* Edit panel */
.editPanel {
  padding: 1rem; border-bottom: 1px solid var(--color-border);
  background: rgba(0,0,0,0.015);
}
.editFields { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }

/* Brand tabs */
.brandTabs { display: flex; gap: 0; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
.brandTab {
  padding: 0.5rem 1rem;
  font-family: var(--font-body); font-size: 0.7rem;
  font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--color-muted); cursor: pointer;
}
.brandTabActive { border-bottom-color: var(--color-text); color: var(--color-text); }

/* Editor controls */
.editorSectionTitle {
  font-family: var(--font-body); font-size: 0.7rem;
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--color-muted); margin-top: 0.5rem;
}
.editorLabel {
  display: flex; flex-direction: column; gap: 0.3rem;
  font-family: var(--font-body); font-size: 0.7rem;
  font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: var(--color-muted);
}
.editorInput {
  padding: 0.5rem 0.7rem;
  font-family: var(--font-body); font-size: 0.85rem;
  border: 1px solid var(--color-border); background: transparent;
  color: var(--color-text); width: 100%; max-width: 300px;
}
.editorInput:focus { outline: none; border-color: var(--color-text); }
.editorInputSm { composes: editorInput; width: 80px; max-width: 80px; }
.editorRow { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.editorPrefix {
  font-family: var(--font-body); font-size: 0.8rem; color: var(--color-muted);
}

/* Pricing editor */
.pricingEditor { display: flex; flex-direction: column; gap: 0.75rem; }
.tierEditor { display: flex; flex-direction: column; gap: 0.5rem; }
.tierRow { display: flex; align-items: center; gap: 0.5rem; }
.addTierBtn, .removeTierBtn {
  font-family: var(--font-body); font-size: 0.75rem;
  background: transparent; border: 1px solid var(--color-border);
  color: var(--color-muted); padding: 0.3rem 0.6rem; cursor: pointer;
}
.addTierBtn:hover, .removeTierBtn:hover { color: var(--color-text); border-color: var(--color-text); }

/* Modifiers */
.modifiers { display: flex; flex-direction: column; gap: 0.5rem; }
.modifierCheck {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: var(--font-body); font-size: 0.8rem; cursor: pointer;
}
.modifierCheck input[type="checkbox"] { width: 16px; height: 16px; }

/* Input field editor */
.inputFieldRow { display: flex; align-items: center; gap: 0.5rem; }

/* Create rows */
.createServiceRow, .createCategoryRow {
  display: flex; gap: 0.5rem; padding: 0.6rem 1rem;
}
.createBtn {
  padding: 0.5rem 1rem;
  font-family: var(--font-body); font-size: 0.7rem;
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  background: var(--color-text); color: var(--color-white);
  border: 1px solid var(--color-text); cursor: pointer;
}
.createBtn:hover { opacity: 0.85; }

/* Save */
.saveBtn {
  padding: 0.6rem 1.25rem;
  font-family: var(--font-body); font-size: 0.75rem;
  font-weight: 600; letter-spacing: 0.15em; text-transform: uppercase;
  background: var(--color-text); color: var(--color-white);
  border: 1px solid var(--color-text); cursor: pointer;
}
.saveBtn:hover:not(:disabled) { opacity: 0.85; }
.saveBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/services/
git commit -m "feat: add admin services page with pricing rules editor and brand overrides"
```

---

## Task 10: Update Booking Flow — Dynamic PropertyBlock

**Files:**
- Modify: `src/components/BookingSection.tsx`
- Modify: `src/components/PropertyBlock.tsx`

- [ ] **Step 1: Update BookingSection to fetch services and use new data model**

Replace the `PropertyBooking` interface and `createProperty` function. Add a services fetch. The new `PropertyBooking` stores selected services as a `Record<serviceId, Record<inputKey, value>>` instead of individual boolean flags.

In `src/components/BookingSection.tsx`:

Replace the `PropertyBooking` interface (lines 21-42) and `createProperty` function (lines 49-72) with:

```typescript
export interface SelectedService {
  serviceId: string;
  inputs: Record<string, number | string | boolean>;
}

export interface PropertyBooking {
  id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string;
  notes: string;
  selectedServices: SelectedService[];
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    postcode: "",
    bedrooms: 2,
    preferredDate: "",
    timeSlot: "",
    notes: "",
    selectedServices: [],
  };
}
```

Add a state for services and fetch them on mount. Add imports for `ResolvedCategory` and `getBrandMode`:

```typescript
import { getBrandMode } from "@/lib/brand";

// Inside BookingSection component:
const [serviceCategories, setServiceCategories] = useState<ResolvedCategory[]>([]);

useEffect(() => {
  fetch(`/api/services?brand=${getBrandMode()}`)
    .then((r) => r.json())
    .then(setServiceCategories)
    .catch(console.error);
}, []);
```

Pass `serviceCategories` to `PropertyBlock` and `Basket`:

```tsx
<PropertyBlock
  key={property.id}
  property={property}
  serviceCategories={serviceCategories}
  siblingBookings={siblingMap.get(property.id) || []}
  onChange={(updates) => updateProperty(property.id, updates)}
  onRemove={() => removeProperty(property.id)}
  canRemove={properties.length > 1}
  errors={errors.properties[property.id]}
  onClearError={(field) => clearPropertyError(property.id, field)}
/>
```

Update the validate function to check `selectedServices` length > 0 instead of checking individual boolean flags. Update the sibling map to use `evaluateDuration` instead of `calcShootMinutes`.

Remove imports of `calcShootMinutes` from `@/lib/scheduling` and add:

```typescript
import { evaluateDuration } from "@/lib/pricing-engine";
```

Update siblingMap to compute duration dynamically from the services data.

- [ ] **Step 2: Rewrite PropertyBlock to render services dynamically**

Replace the entire `PropertyBlock.tsx` with a version that:
1. Receives `serviceCategories` as a prop
2. Renders service toggle pills grouped by category
3. Shows add-ons nested under their parent
4. Renders dynamic input fields (number inputs, selects, checkboxes) based on each service's `inputFields`
5. Uses `evaluatePrice` for the subtotal and `evaluateDuration` for scheduling

The key change: instead of hardcoded `togglePhotography()`, `toggleStandardVideo()` etc., there's a generic `toggleService(serviceId)` that adds/removes from `selectedServices`. Mutual exclusivity within a category (e.g. you can only pick one floor plan type) is NOT enforced at the engine level — it's a UI choice. For backward compatibility with existing categories, the admin can configure exclusion groups later. For now, services within the same category are independently selectable.

For the `bedrooms` input: it's collected at the property level and automatically injected into the inputs for every service that needs it (the engine checks for `bedrooms` key).

- [ ] **Step 3: Commit**

```bash
git add src/components/BookingSection.tsx src/components/PropertyBlock.tsx
git commit -m "feat: rewrite booking form to use dynamic services from database"
```

---

## Task 11: Update Basket — Dynamic Pricing Display

**Files:**
- Modify: `src/components/Basket.tsx`

- [ ] **Step 1: Rewrite Basket to use evaluatePrice**

Replace all imports from `@/lib/pricing` with:

```typescript
import { evaluatePrice, calcMultiPropertyDiscount } from "@/lib/pricing-engine";
```

Replace `getLineItems()` with a version that iterates over `property.selectedServices`, looks up the service definition from the `serviceCategories` prop, and calls `evaluatePrice()` for each.

The Basket now needs `serviceCategories` as a prop (passed through from BookingSection).

Update the Props interface:

```typescript
interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
  discountCode: string;
  discountPercentage: number;
  onValidate: () => boolean;
  serviceCategories: ResolvedCategory[];
}
```

The `getLineItems` function becomes:

```typescript
function getLineItems(property: PropertyBooking, allServices: ResolvedService[]) {
  const items: { label: string; price: number; indent?: boolean }[] = [];

  for (const sel of property.selectedServices) {
    const svc = allServices.find((s) => s.id === sel.serviceId);
    if (!svc) continue;

    const inputs = { ...sel.inputs, bedrooms: property.bedrooms };
    const result = evaluatePrice(svc.pricingRules, inputs);

    items.push({
      label: svc.name,
      price: result.total,
      indent: svc.isAddon,
    });
  }

  return items;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Basket.tsx
git commit -m "feat: update Basket to use dynamic pricing engine"
```

---

## Task 12: Update Checkout API

**Files:**
- Modify: `src/app/api/checkout/route.ts`

- [ ] **Step 1: Rewrite checkout to use dynamic services**

Replace the imports from `@/lib/pricing` and `@/lib/scheduling` with:

```typescript
import { evaluatePrice, evaluateDuration, calcMultiPropertyDiscount } from "@/lib/pricing-engine";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";
```

Update the `CheckoutBody` interface — properties now have `selectedServices` instead of individual boolean flags:

```typescript
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
```

Rewrite `buildLineItems()` to:
1. Fetch services from DB via `getServicesForBrand()`
2. For each property, for each selected service, call `evaluatePrice()` to get the amount
3. Build Stripe line items with dynamic service names

Rewrite the booking insertion to:
1. Store `selectedServices` with computed prices in the `services` JSON column
2. Compute `workHours` by summing `evaluateDuration()` for all selected services
3. Compute `subtotal` and `total` using the pricing engine

Update metadata format to store service IDs + inputs instead of boolean flags:

```typescript
metadata[`prop_${i}_svc`] = JSON.stringify(
  p.selectedServices.map((s) => ({
    id: s.serviceId,
    in: s.inputs,
  }))
);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/checkout/route.ts
git commit -m "feat: update checkout API to use dynamic pricing engine"
```

---

## Task 13: Update Webhook

**Files:**
- Modify: `src/app/api/webhook/stripe/route.ts`

- [ ] **Step 1: Update webhook to use stored service data**

The webhook currently recalculates prices from the boolean service flags in metadata. With the new system, the booking record already has the computed prices stored in its `services` JSON column (written at checkout time). The webhook just needs to:

1. Confirm the pending bookings (already does this)
2. Build email data from the stored booking records instead of re-parsing metadata

Remove all imports from `@/lib/pricing` and `@/lib/scheduling`. The email service names and amounts come from the booking records:

```typescript
// After confirming bookings, fetch them for email data
const confirmedBookings = await db
  .select()
  .from(bookings)
  .where(eq(bookings.stripeSession, session.id));
```

Build `emailProperties` from the confirmed bookings' stored `services` JSON, which now contains `{ serviceId, inputs, computedPrice, serviceName }` for each selected service.

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhook/stripe/route.ts
git commit -m "feat: update Stripe webhook to use stored service data"
```

---

## Task 14: Update Signup-with-Booking

**Files:**
- Modify: `src/app/api/portal/signup-with-booking/route.ts`

- [ ] **Step 1: Update to use dynamic pricing**

Same pattern as checkout: replace `PropertyServices` with the new `selectedServices` format. Use `evaluatePrice()` and `evaluateDuration()` instead of `calcPropertyTotal()` and `calcWorkHours()`.

Replace imports:

```typescript
import { evaluatePrice, evaluateDuration } from "@/lib/pricing-engine";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/portal/signup-with-booking/route.ts
git commit -m "feat: update signup-with-booking to use dynamic pricing engine"
```

---

## Task 15: Update Account Invoice PDF

**Files:**
- Modify: `src/lib/account-invoice-pdf.ts`

- [ ] **Step 1: Update parseServiceNames for new format**

The `services` JSON in bookings now stores an array of `{ serviceId, serviceName, inputs, computedPrice }` objects. Update `parseServiceNames()` to handle both old format (boolean flags) and new format (service array):

```typescript
function parseServiceNames(servicesJson: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(servicesJson);
  } catch {
    return [];
  }

  // New format: array of selected services
  if (Array.isArray(parsed)) {
    return parsed.map((s: { serviceName?: string; serviceId?: string }) => s.serviceName || s.serviceId || "Service");
  }

  // Legacy format: boolean flags
  const svc = parsed as Record<string, unknown>;
  const names: string[] = [];
  if (svc.photography) names.push(`Photography (${svc.photoCount ?? 0} photos)`);
  if (svc.dronePhotography) names.push(`Drone Photography (${svc.dronePhotoCount ?? 8} photos)`);
  if (svc.standardVideo) names.push("Standard Video");
  if (svc.agentPresentedVideo) names.push("Agent-Presented Video");
  if (svc.socialMediaVideo) names.push("Social Media Video");
  if (svc.socialMediaPresentedVideo) names.push("Social Media Presented Video");
  if (svc.standardFloorPlan) names.push("Standard Floor Plan");
  if (svc.premiumFloorPlan) names.push("Premium Floor Plan");
  if (svc.floorPlan3D) names.push("3D Floor Plan");
  return names;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/account-invoice-pdf.ts
git commit -m "feat: update account invoice PDF to handle dynamic service format"
```

---

## Task 16: Update Scheduling

**Files:**
- Modify: `src/lib/scheduling.ts`

- [ ] **Step 1: Add dynamic duration calculation alongside existing one**

Add a new function that works with the dynamic service format. Keep the old `calcShootMinutes` for backward compat with any code that still uses it, but add:

```typescript
import { evaluateDuration, type DurationRules } from "@/lib/pricing-engine";

export interface DynamicServiceSelection {
  durationRules: DurationRules;
  inputs: Record<string, number | string | boolean>;
}

export function calcDynamicShootMinutes(selectedServices: DynamicServiceSelection[]): number {
  return selectedServices.reduce(
    (total, svc) => total + evaluateDuration(svc.durationRules, svc.inputs),
    0
  );
}

export function calcDynamicWorkHours(selectedServices: DynamicServiceSelection[]): number {
  return Math.round((calcDynamicShootMinutes(selectedServices) / 60) * 100) / 100;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scheduling.ts
git commit -m "feat: add dynamic duration calculation to scheduling"
```

---

## Task 17: Delete Old Pricing Module

**Files:**
- Delete: `src/lib/pricing.ts`

- [ ] **Step 1: Search for remaining imports of pricing.ts**

```bash
grep -r "from.*@/lib/pricing" src/ --include="*.ts" --include="*.tsx" | grep -v pricing-engine | grep -v node_modules
```

Fix any remaining imports to use `pricing-engine.ts` instead. The `calcMultiPropertyDiscount` function is now in `pricing-engine.ts`.

- [ ] **Step 2: Delete pricing.ts**

```bash
rm src/lib/pricing.ts
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old hardcoded pricing module"
```

---

## Task 18: Integration Test — Verify Seed Prices Match

- [ ] **Step 1: Verify the seeded services produce identical prices to the old hardcoded functions**

After seeding, manually verify a few key calculations via the pricing engine:

```bash
npx tsx -e "
const { evaluatePrice } = require('./src/lib/pricing-engine');

// Photography: 20 photos should be £130 (20 * 6.50)
const photo20 = evaluatePrice(
  { basePrice: 0, rules: [{ type: 'perUnit', input: 'photos', rate: 6.5, freeUnits: 0 }, { type: 'minimum', input: 'photos', minValue: 20 }, { type: 'bulkDiscount', input: 'photos', threshold: 100, percent: 10 }] },
  { photos: 20 }
);
console.log('Photography 20 photos:', photo20.total, '(expected 130)');

// Standard video 3-bed: £100 + (3-2)*25 = £125
const vid3 = evaluatePrice(
  { basePrice: 100, rules: [{ type: 'perUnit', input: 'bedrooms', rate: 25, freeUnits: 2 }] },
  { bedrooms: 3 }
);
console.log('Standard Video 3-bed:', vid3.total, '(expected 125)');

// Bulk photo discount: 100 photos = 100*6.50 = 650, -10% = 585
const photo100 = evaluatePrice(
  { basePrice: 0, rules: [{ type: 'perUnit', input: 'photos', rate: 6.5, freeUnits: 0 }, { type: 'bulkDiscount', input: 'photos', threshold: 100, percent: 10 }] },
  { photos: 100 }
);
console.log('Photography 100 photos:', photo100.total, '(expected 585)');
"
```

- [ ] **Step 2: Commit a passing state**

```bash
git add -A
git commit -m "test: verify seed service prices match legacy calculations"
```

---

## Task 19: Full Build & Smoke Test

- [ ] **Step 1: Run the full build**

```bash
npx next build
```

Fix any type errors or build failures.

- [ ] **Step 2: Test the admin services page locally**

```bash
npx next dev
```

Navigate to `/admin/services` and verify:
- Categories and services load correctly from seed data
- Can edit a service's pricing rules
- Can toggle visibility
- Can create a new service
- Brand override tabs work

- [ ] **Step 3: Test the booking page**

Navigate to `/book` and verify:
- Services load dynamically
- Selecting services updates the basket with correct prices
- Time slot selection still works
- Checkout flow works end-to-end

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete dynamic services & pricing system"
```
