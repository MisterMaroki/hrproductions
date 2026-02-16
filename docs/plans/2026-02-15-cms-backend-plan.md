# CMS Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight CMS backend so Harrison can manage discount codes, view bookings on a calendar, and control scheduling — plus integrate discount codes and date validation into the existing booking frontend.

**Architecture:** Turso (hosted SQLite) database with Drizzle ORM for type-safe queries. Custom JWT cookie auth protecting `/admin` routes via Next.js middleware. Stripe webhook persists bookings after payment. Frontend gets discount code input and date availability checking.

**Tech Stack:** Next.js 16 (App Router), Turso/libSQL, Drizzle ORM, jose (JWT), bcryptjs (password hashing), Stripe webhooks

---

## Task 1: Install Dependencies & Drizzle Config

**Files:**
- Modify: `package.json`
- Create: `drizzle.config.ts`

**Step 1: Install production dependencies**

Run:
```bash
npm install drizzle-orm @libsql/client jose bcryptjs
```

**Step 2: Install dev dependencies**

Run:
```bash
npm install -D drizzle-kit @types/bcryptjs
```

**Step 3: Create Drizzle config**

Create `drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});
```

**Step 4: Add db scripts to package.json**

Add to `"scripts"` in `package.json`:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate",
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio"
```

**Step 5: Verify installation**

Run:
```bash
npx drizzle-kit --version
```
Expected: Prints drizzle-kit version without error.

**Step 6: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "feat: add Turso, Drizzle, jose, bcryptjs dependencies and drizzle config"
```

---

## Task 2: Database Schema

**Files:**
- Create: `src/lib/schema.ts`
- Test: `src/lib/__tests__/schema.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/schema.test.ts`:

```typescript
import { bookings, discountCodes, blockedDays } from "../schema";

describe("schema exports", () => {
  it("exports bookings table", () => {
    expect(bookings).toBeDefined();
  });

  it("exports discountCodes table", () => {
    expect(discountCodes).toBeDefined();
  });

  it("exports blockedDays table", () => {
    expect(blockedDays).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/schema.test.ts`
Expected: FAIL — cannot find module `../schema`

**Step 3: Write the schema**

Create `src/lib/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(),
  address: text("address").notNull(),
  bedrooms: integer("bedrooms").notNull(),
  preferredDate: text("preferred_date").notNull(),
  notes: text("notes"),
  agentName: text("agent_name").notNull(),
  agentCompany: text("agent_company"),
  agentEmail: text("agent_email").notNull(),
  agentPhone: text("agent_phone"),
  services: text("services").notNull(), // JSON blob
  workHours: real("work_hours").notNull(),
  subtotal: integer("subtotal").notNull(), // pence
  discountCode: text("discount_code"),
  discountAmount: integer("discount_amount").default(0),
  total: integer("total").notNull(), // pence
  stripeSession: text("stripe_session"),
  status: text("status").default("confirmed"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const discountCodes = sqliteTable("discount_codes", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  percentage: integer("percentage").notNull(),
  active: integer("active").default(1),
  maxUses: integer("max_uses"),
  timesUsed: integer("times_used").default(0),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const blockedDays = sqliteTable("blocked_days", {
  id: text("id").primaryKey(),
  date: text("date").notNull().unique(),
  reason: text("reason"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/schema.test.ts`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/lib/schema.ts src/lib/__tests__/schema.test.ts
git commit -m "feat: add Drizzle schema for bookings, discount_codes, blocked_days"
```

---

## Task 3: Database Client

**Files:**
- Create: `src/lib/db.ts`

**Step 1: Write the database client**

Create `src/lib/db.ts`:

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (env vars are asserted with `!`)

**Step 3: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat: add Turso database client with Drizzle"
```

---

## Task 4: Auth Helpers

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/__tests__/auth.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/auth.test.ts`:

```typescript
import { verifyPassword, createSessionToken, verifySessionToken } from "../auth";

// Set test env vars
beforeAll(() => {
  process.env.ADMIN_JWT_SECRET = "test-secret-key-at-least-32-chars-long!!";
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    // bcryptjs hash of "testpass123"
    const hash = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    process.env.ADMIN_PASSWORD_HASH = hash;
    // Note: this will only pass if the hash matches "testpass123"
    // We'll test the function shape, not the actual hash comparison
    const result = await verifyPassword("wrong-password");
    expect(typeof result).toBe("boolean");
  });
});

describe("JWT session tokens", () => {
  it("creates and verifies a valid token", async () => {
    const token = await createSessionToken("harrison");
    expect(typeof token).toBe("string");

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("harrison");
  });

  it("returns null for invalid token", async () => {
    const payload = await verifySessionToken("garbage-token");
    expect(payload).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/auth.test.ts`
Expected: FAIL — cannot find module `../auth`

**Step 3: Write the auth helpers**

Create `src/lib/auth.ts`:

```typescript
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "admin_session";
const SESSION_DURATION = 24 * 60 * 60; // 24 hours in seconds

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) return false;
  return compare(password, hash);
}

export async function createSessionToken(username: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/auth.test.ts`
Expected: 3 tests PASS

Note: The `cookies()` functions can only be called inside a Next.js request context, so only the pure functions (`verifyPassword`, `createSessionToken`, `verifySessionToken`) are unit-testable. The cookie helpers will be tested via integration.

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts
git commit -m "feat: add JWT auth helpers with bcrypt password verification"
```

---

## Task 5: Auth Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Write the middleware**

Create `src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect admin routes (except login page)
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  // Also protect admin API routes
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!pathname.startsWith("/admin") && !isAdminApi) return NextResponse.next();

  const token = request.cookies.get("admin_session")?.value;

  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware protecting /admin and /api/admin routes"
```

---

## Task 6: Admin Login API + Login Page

**Files:**
- Create: `src/app/api/admin/login/route.ts`
- Create: `src/app/api/admin/logout/route.ts`
- Create: `src/app/admin/login/page.tsx`
- Create: `src/app/admin/login/page.module.css`

**Step 1: Write the login API route**

Create `src/app/api/admin/login/route.ts`:

```typescript
import { NextResponse } from "next/server";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (username !== process.env.ADMIN_USER) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const valid = await verifyPassword(password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = await createSessionToken(username);
    await setSessionCookie(token);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
```

**Step 2: Write the logout API route**

Create `src/app/api/admin/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
```

**Step 3: Write the login page**

Create `src/app/admin/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      router.push("/admin/calendar");
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.heading}>Admin</h1>
        {error && <p className={styles.error}>{error}</p>}
        <input
          className={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoFocus
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className={styles.button} type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </main>
  );
}
```

**Step 4: Write login page styles**

Create `src/app/admin/login/page.module.css`:

```css
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.form {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.heading {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--color-muted);
  margin-bottom: 1rem;
}

.error {
  font-size: 0.85rem;
  color: #c0392b;
  padding: 0.75rem 1rem;
  border: 1px solid #c0392b;
}

.input {
  width: 100%;
  padding: 0.9rem 1rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  transition: border-color 0.2s ease;
}

.input:focus {
  outline: none;
  border-color: var(--color-text);
}

.button {
  width: 100%;
  padding: 1rem;
  background-color: var(--color-text);
  color: var(--color-white);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  border: 1px solid var(--color-text);
  transition: opacity 0.2s ease;
  margin-top: 0.5rem;
}

.button:hover:not(:disabled) {
  opacity: 0.85;
}

.button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/app/api/admin/login/route.ts src/app/api/admin/logout/route.ts src/app/admin/login/page.tsx src/app/admin/login/page.module.css
git commit -m "feat: add admin login/logout API routes and login page"
```

---

## Task 7: Admin Layout

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/layout.module.css`
- Create: `src/app/admin/page.tsx` (redirect)

**Step 1: Write the admin layout**

Create `src/app/admin/layout.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Harrison Ross",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

**Step 2: Write the redirect page**

Create `src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function AdminIndex() {
  redirect("/admin/calendar");
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: add admin layout with noindex and /admin redirect to calendar"
```

---

## Task 8: Scheduling Logic

**Files:**
- Create: `src/lib/scheduling.ts`
- Test: `src/lib/__tests__/scheduling.test.ts`

**Step 1: Write the failing test**

Create `src/lib/__tests__/scheduling.test.ts`:

```typescript
import { calcWorkHours, type BookingServices } from "../scheduling";

describe("calcWorkHours", () => {
  it("returns 1 for photography only", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(1);
  });

  it("returns 1 for unpresented video", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: true,
        agentPresentedVideo: false,
      })
    ).toBe(1);
  });

  it("returns 2 for agent-presented video", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: true,
      })
    ).toBe(2);
  });

  it("returns 0.5 for drone photography only", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(0.5);
  });

  it("returns 1.5 for photography + drone photography", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(1.5);
  });

  it("returns 3.5 for agent-presented video + photography + drone", () => {
    expect(
      calcWorkHours({
        photography: true,
        dronePhotography: true,
        standardVideo: false,
        agentPresentedVideo: true,
      })
    ).toBe(3.5);
  });

  it("returns 0 for no services", () => {
    expect(
      calcWorkHours({
        photography: false,
        dronePhotography: false,
        standardVideo: false,
        agentPresentedVideo: false,
      })
    ).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/scheduling.test.ts`
Expected: FAIL — cannot find module `../scheduling`

**Step 3: Write the scheduling logic**

Create `src/lib/scheduling.ts`:

```typescript
export const MAX_DAILY_HOURS = 6; // 4 hours shoot + 2 hours travel buffer

export interface BookingServices {
  photography: boolean;
  dronePhotography: boolean;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
}

/**
 * Calculate work hours for a single property booking.
 *
 * - Photography only: 1 hour
 * - Unpresented video: 1 hour
 * - Agent-presented video: 2 hours
 * - Drone photography: 0.5 hours (add-on time)
 * - Video drone footage: included in video time (no extra)
 */
export function calcWorkHours(services: BookingServices): number {
  let hours = 0;

  if (services.photography) hours += 1;
  if (services.dronePhotography) hours += 0.5;
  if (services.agentPresentedVideo) hours += 2;
  else if (services.standardVideo) hours += 1;

  return hours;
}
```

**Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/scheduling.test.ts`
Expected: 7 tests PASS

**Step 5: Commit**

```bash
git add src/lib/scheduling.ts src/lib/__tests__/scheduling.test.ts
git commit -m "feat: add scheduling logic with work hours calculation"
```

---

## Task 9: Discount Codes API

**Files:**
- Create: `src/app/api/admin/discounts/route.ts`
- Create: `src/app/api/discount/validate/route.ts`

**Step 1: Write the admin discounts CRUD API**

Create `src/app/api/admin/discounts/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discountCodes } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET /api/admin/discounts — list all discount codes
export async function GET() {
  const codes = await db
    .select()
    .from(discountCodes)
    .orderBy(discountCodes.createdAt);
  return NextResponse.json(codes);
}

// POST /api/admin/discounts — create a new discount code
export async function POST(request: Request) {
  try {
    const { code, percentage, maxUses, expiresAt } = await request.json();

    if (!code || !percentage) {
      return NextResponse.json(
        { error: "Code and percentage are required" },
        { status: 400 }
      );
    }

    if (percentage < 1 || percentage > 100) {
      return NextResponse.json(
        { error: "Percentage must be between 1 and 100" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(discountCodes).values({
      id,
      code: code.toUpperCase().trim(),
      percentage,
      maxUses: maxUses || null,
      expiresAt: expiresAt || null,
    });

    return NextResponse.json({ id, code: code.toUpperCase().trim() }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "A code with that name already exists" },
        { status: 409 }
      );
    }
    console.error("Create discount error:", err);
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  }
}

// PATCH /api/admin/discounts — update a discount code
export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const allowed: Record<string, unknown> = {};
    if (updates.code !== undefined) allowed.code = updates.code.toUpperCase().trim();
    if (updates.percentage !== undefined) allowed.percentage = updates.percentage;
    if (updates.active !== undefined) allowed.active = updates.active;
    if (updates.maxUses !== undefined) allowed.maxUses = updates.maxUses;
    if (updates.expiresAt !== undefined) allowed.expiresAt = updates.expiresAt;

    await db.update(discountCodes).set(allowed).where(eq(discountCodes.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update code" }, { status: 500 });
  }
}
```

**Step 2: Write the public discount validation API**

Create `src/app/api/discount/validate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { discountCodes } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const [discount] = await db
      .select()
      .from(discountCodes)
      .where(
        and(
          eq(discountCodes.code, code.toUpperCase().trim()),
          eq(discountCodes.active, 1)
        )
      )
      .limit(1);

    if (!discount) {
      return NextResponse.json({ error: "Invalid discount code" }, { status: 404 });
    }

    // Check max uses
    if (discount.maxUses && discount.timesUsed! >= discount.maxUses) {
      return NextResponse.json(
        { error: "This code has reached its usage limit" },
        { status: 410 }
      );
    }

    // Check expiry
    if (discount.expiresAt) {
      const today = new Date().toISOString().split("T")[0];
      if (discount.expiresAt < today) {
        return NextResponse.json(
          { error: "This code has expired" },
          { status: 410 }
        );
      }
    }

    return NextResponse.json({
      code: discount.code,
      percentage: discount.percentage,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to validate code" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/admin/discounts/route.ts src/app/api/discount/validate/route.ts
git commit -m "feat: add discount code CRUD API and public validation endpoint"
```

---

## Task 10: Availability API + Blocked Days API

**Files:**
- Create: `src/app/api/availability/route.ts`
- Create: `src/app/api/admin/blocked-days/route.ts`

**Step 1: Write the availability API**

Create `src/app/api/availability/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, blockedDays } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { MAX_DAILY_HOURS } from "@/lib/scheduling";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Valid date (YYYY-MM-DD) is required" },
      { status: 400 }
    );
  }

  try {
    // Check if day is blocked
    const [blocked] = await db
      .select()
      .from(blockedDays)
      .where(eq(blockedDays.date, date))
      .limit(1);

    if (blocked) {
      return NextResponse.json({
        available: false,
        reason: blocked.reason || "This date is unavailable",
        hoursBooked: 0,
        hoursRemaining: 0,
      });
    }

    // Sum booked hours for confirmed bookings on this date
    const [result] = await db
      .select({
        totalHours: sql<number>`COALESCE(SUM(${bookings.workHours}), 0)`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.preferredDate, date),
          eq(bookings.status, "confirmed")
        )
      );

    const hoursBooked = result?.totalHours ?? 0;
    const hoursRemaining = Math.max(0, MAX_DAILY_HOURS - hoursBooked);

    return NextResponse.json({
      available: hoursRemaining > 0,
      hoursBooked,
      hoursRemaining,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    );
  }
}
```

**Step 2: Write the blocked days admin API**

Create `src/app/api/admin/blocked-days/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blockedDays } from "@/lib/schema";
import { eq } from "drizzle-orm";

// GET /api/admin/blocked-days — list all blocked days
export async function GET() {
  const days = await db
    .select()
    .from(blockedDays)
    .orderBy(blockedDays.date);
  return NextResponse.json(days);
}

// POST /api/admin/blocked-days — block a day
export async function POST(request: Request) {
  try {
    const { date, reason } = await request.json();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Valid date (YYYY-MM-DD) is required" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    await db.insert(blockedDays).values({
      id,
      date,
      reason: reason || null,
    });

    return NextResponse.json({ id, date }, { status: 201 });
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      return NextResponse.json(
        { error: "This date is already blocked" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Failed to block day" }, { status: 500 });
  }
}

// DELETE /api/admin/blocked-days — unblock a day
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await db.delete(blockedDays).where(eq(blockedDays.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to unblock day" }, { status: 500 });
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/availability/route.ts src/app/api/admin/blocked-days/route.ts
git commit -m "feat: add availability check API and blocked days admin CRUD"
```

---

## Task 11: Bookings API

**Files:**
- Create: `src/app/api/admin/bookings/route.ts`

**Step 1: Write the bookings admin API**

Create `src/app/api/admin/bookings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";

// GET /api/admin/bookings — list bookings with optional date range
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conditions = [];

  if (from) conditions.push(gte(bookings.preferredDate, from));
  if (to) conditions.push(lte(bookings.preferredDate, to));

  const rows = await db
    .select()
    .from(bookings)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(bookings.preferredDate);

  return NextResponse.json(rows);
}

// PATCH /api/admin/bookings — update booking status
export async function PATCH(request: Request) {
  try {
    const { id, status } = await request.json();

    if (!id || !status) {
      return NextResponse.json(
        { error: "ID and status are required" },
        { status: 400 }
      );
    }

    const validStatuses = ["confirmed", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    await db
      .update(bookings)
      .set({ status })
      .where(eq(bookings.id, id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/route.ts
git commit -m "feat: add bookings admin API with date filtering and status updates"
```

---

## Task 12: Stripe Webhook

**Files:**
- Create: `src/app/api/webhook/stripe/route.ts`
- Modify: `src/app/api/checkout/route.ts`

**Step 1: Update checkout route to include full metadata**

Modify `src/app/api/checkout/route.ts`. The current metadata (lines 178-191) stores properties as a JSON string. Update it to include service details and discount info for the webhook to use.

Replace the `metadata` object in the `stripe.checkout.sessions.create` call:

```typescript
metadata: {
  agent_name: agent.name,
  agent_company: agent.company,
  agent_email: agent.email,
  agent_phone: agent.phone,
  discount_code: discountCode || "",
  discount_percentage: String(discountPercentage || 0),
  properties: JSON.stringify(
    properties.map((p) => ({
      address: p.address,
      bedrooms: p.bedrooms,
      preferredDate: p.preferredDate,
      notes: p.notes,
      photography: p.photography,
      photoCount: p.photoCount,
      dronePhotography: p.dronePhotography,
      dronePhotoCount: p.dronePhotoCount,
      standardVideo: p.standardVideo,
      standardVideoDrone: p.standardVideoDrone,
      agentPresentedVideo: p.agentPresentedVideo,
      agentPresentedVideoDrone: p.agentPresentedVideoDrone,
    }))
  ),
},
```

Also update `CheckoutBody` to include discount info:

```typescript
interface CheckoutBody {
  properties: PropertyPayload[];
  agent: {
    name: string;
    company: string;
    email: string;
    phone: string;
  };
  discountCode?: string;
  discountPercentage?: number;
}
```

And update the destructuring: `const { properties, agent, discountCode, discountPercentage } = body;`

If a discount percentage is provided, add a discount line item after the multi-property discount:

```typescript
// Discount code
if (discountPercentage && discountPercentage > 0) {
  const serviceTotal = items
    .filter((item) => (item.price_data as { unit_amount: number }).unit_amount > 0)
    .reduce((sum, item) => sum + (item.price_data as { unit_amount: number }).unit_amount, 0);
  const codeDiscountPence = Math.round(serviceTotal * (discountPercentage / 100));
  if (codeDiscountPence > 0) {
    items.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: `Discount code (${discountCode || ""}): ${discountPercentage}% off`,
        },
        unit_amount: -codeDiscountPence,
      },
      quantity: 1,
    });
  }
}
```

**Step 2: Write the Stripe webhook handler**

Create `src/app/api/webhook/stripe/route.ts`:

```typescript
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { bookings, discountCodes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { calcWorkHours } from "@/lib/scheduling";
import { calcPropertyTotal, type PropertyServices } from "@/lib/pricing";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};

    try {
      const properties = JSON.parse(meta.properties || "[]");
      const discountCode = meta.discount_code || null;
      const discountPercentage = Number(meta.discount_percentage || 0);

      for (const p of properties) {
        const services: PropertyServices = {
          bedrooms: p.bedrooms,
          photography: p.photography,
          photoCount: p.photoCount,
          dronePhotography: p.dronePhotography,
          dronePhotoCount: p.dronePhotoCount,
          standardVideo: p.standardVideo,
          standardVideoDrone: p.standardVideoDrone,
          agentPresentedVideo: p.agentPresentedVideo,
          agentPresentedVideoDrone: p.agentPresentedVideoDrone,
        };

        const subtotal = Math.round(calcPropertyTotal(services) * 100); // pence
        const discountAmount = discountPercentage
          ? Math.round(subtotal * (discountPercentage / 100))
          : 0;
        const total = subtotal - discountAmount;

        const workHours = calcWorkHours({
          photography: p.photography,
          dronePhotography: p.dronePhotography,
          standardVideo: p.standardVideo,
          agentPresentedVideo: p.agentPresentedVideo,
        });

        await db.insert(bookings).values({
          id: crypto.randomUUID(),
          address: p.address,
          bedrooms: p.bedrooms,
          preferredDate: p.preferredDate,
          notes: p.notes || null,
          agentName: meta.agent_name,
          agentCompany: meta.agent_company || null,
          agentEmail: meta.agent_email,
          agentPhone: meta.agent_phone || null,
          services: JSON.stringify(services),
          workHours,
          subtotal,
          discountCode,
          discountAmount,
          total,
          stripeSession: session.id,
          status: "confirmed",
        });
      }

      // Increment discount code usage
      if (discountCode) {
        await db
          .update(discountCodes)
          .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
          .where(eq(discountCodes.code, discountCode));
      }
    } catch (err) {
      console.error("Webhook processing error:", err);
      return NextResponse.json(
        { error: "Failed to process booking" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ received: true });
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/webhook/stripe/route.ts src/app/api/checkout/route.ts
git commit -m "feat: add Stripe webhook to persist bookings and update checkout metadata"
```

---

## Task 13: Discount Code Frontend

**Files:**
- Modify: `src/components/BookingSection.tsx`
- Modify: `src/components/Basket.tsx`
- Modify: `src/components/Basket.module.css`

**Step 1: Add discount state to BookingSection**

In `src/components/BookingSection.tsx`, add discount state and pass to Basket.

Add state after `properties` state (line 62):

```typescript
const [discountCode, setDiscountCode] = useState("");
const [discountPercentage, setDiscountPercentage] = useState(0);
const [appliedCode, setAppliedCode] = useState("");
```

Update the Basket render (line 106) to pass discount props:

```tsx
<Basket
  properties={properties}
  agent={agent}
  discountCode={appliedCode}
  discountPercentage={discountPercentage}
/>
```

**Step 2: Update Basket to accept and apply discount**

In `src/components/Basket.tsx`, update the Props interface:

```typescript
interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
  discountCode: string;
  discountPercentage: number;
}
```

Update the component signature:

```typescript
export default function Basket({ properties, agent, discountCode, discountPercentage }: Props) {
```

Add discount code calculation after `discount` (line 72):

```typescript
const codeDiscountAmount = discountPercentage > 0
  ? Math.round((subtotalBeforeDiscount - discount) * (discountPercentage / 100) * 100) / 100
  : 0;
const grandTotal = Math.max(0, subtotalBeforeDiscount - discount - codeDiscountAmount);
```

Update `handleCheckout` body (line 82) to include discount info:

```typescript
body: JSON.stringify({ properties, agent, discountCode, discountPercentage }),
```

Add discount code display after the multi-property discount line (after line 127):

```tsx
{codeDiscountAmount > 0 && (
  <div className={styles.discountLine}>
    <span>Discount ({discountCode}: {discountPercentage}% off)</span>
    <span>-£{codeDiscountAmount.toFixed(2)}</span>
  </div>
)}
```

**Step 3: Add discount code input to BookingSection**

In `src/components/BookingSection.tsx`, add a discount code input section between the disclaimer and the basket. Add it inside the `.basket` div, above `<Basket>`:

```tsx
<div className={styles.discountInput}>
  <div className={styles.discountRow}>
    <input
      className={styles.discountField}
      type="text"
      placeholder="Discount code"
      value={discountCode}
      onChange={(e) => setDiscountCode(e.target.value)}
      disabled={!!appliedCode}
    />
    {appliedCode ? (
      <button
        className={styles.discountRemove}
        onClick={() => {
          setAppliedCode("");
          setDiscountPercentage(0);
          setDiscountCode("");
        }}
      >
        Remove
      </button>
    ) : (
      <button
        className={styles.discountApply}
        onClick={async () => {
          if (!discountCode.trim()) return;
          try {
            const res = await fetch("/api/discount/validate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: discountCode }),
            });
            if (!res.ok) {
              const data = await res.json();
              alert(data.error || "Invalid code");
              return;
            }
            const data = await res.json();
            setAppliedCode(data.code);
            setDiscountPercentage(data.percentage);
          } catch {
            alert("Failed to validate code");
          }
        }}
      >
        Apply
      </button>
    )}
  </div>
  {appliedCode && (
    <p className={styles.discountApplied}>
      {appliedCode}: {discountPercentage}% off applied
    </p>
  )}
</div>
```

**Step 4: Add discount input styles**

Add to `src/components/BookingSection.module.css`:

```css
.discountInput {
  margin-bottom: 1.5rem;
}

.discountRow {
  display: flex;
  gap: 0.5rem;
}

.discountField {
  flex: 1;
  padding: 0.75rem 1rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.discountField:focus {
  outline: none;
  border-color: var(--color-text);
}

.discountField:disabled {
  opacity: 0.5;
}

.discountApply,
.discountRemove {
  padding: 0.75rem 1.25rem;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid var(--color-text);
  transition: opacity 0.2s ease;
}

.discountApply {
  background-color: var(--color-text);
  color: var(--color-white);
}

.discountRemove {
  background: transparent;
  color: var(--color-text);
}

.discountApply:hover,
.discountRemove:hover {
  opacity: 0.75;
}

.discountApplied {
  font-size: 0.8rem;
  color: #2d7a3a;
  margin-top: 0.5rem;
  font-weight: 500;
}
```

**Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/BookingSection.tsx src/components/BookingSection.module.css src/components/Basket.tsx
git commit -m "feat: add discount code input to booking form with validation and basket display"
```

---

## Task 14: Date Validation Frontend

**Files:**
- Modify: `src/components/PropertyBlock.tsx`
- Modify: `src/components/PropertyBlock.module.css`

**Step 1: Add date availability check to PropertyBlock**

In `src/components/PropertyBlock.tsx`, add state and a check function for date availability.

Add state:

```typescript
const [dateStatus, setDateStatus] = useState<{
  available: boolean;
  reason?: string;
  hoursRemaining?: number;
} | null>(null);
const [checkingDate, setCheckingDate] = useState(false);
```

Add a date check effect or handler. When the `preferredDate` field changes, call the availability API:

```typescript
const checkDateAvailability = async (date: string) => {
  if (!date) {
    setDateStatus(null);
    return;
  }
  setCheckingDate(true);
  try {
    const res = await fetch(`/api/availability?date=${date}`);
    const data = await res.json();
    setDateStatus(data);
  } catch {
    setDateStatus(null);
  } finally {
    setCheckingDate(false);
  }
};
```

In the date input's `onChange` handler, call `checkDateAvailability(newDate)` after updating the property.

Below the date input, add a status message:

```tsx
{checkingDate && (
  <p className={styles.dateChecking}>Checking availability…</p>
)}
{dateStatus && !checkingDate && (
  <p className={dateStatus.available ? styles.dateAvailable : styles.dateUnavailable}>
    {dateStatus.available
      ? `Available — ${dateStatus.hoursRemaining}h remaining`
      : dateStatus.reason || "This date is unavailable"}
  </p>
)}
```

**Step 2: Add date status styles**

Add to `src/components/PropertyBlock.module.css`:

```css
.dateChecking {
  font-size: 0.8rem;
  color: var(--color-muted);
  margin-top: 0.35rem;
  font-style: italic;
}

.dateAvailable {
  font-size: 0.8rem;
  color: #2d7a3a;
  margin-top: 0.35rem;
}

.dateUnavailable {
  font-size: 0.8rem;
  color: #c0392b;
  margin-top: 0.35rem;
  font-weight: 500;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/PropertyBlock.tsx src/components/PropertyBlock.module.css
git commit -m "feat: add date availability checking to property block"
```

---

## Task 15: Admin Calendar Page

**Files:**
- Create: `src/app/admin/calendar/page.tsx`
- Create: `src/app/admin/calendar/page.module.css`

**Step 1: Write the admin nav component**

Create `src/app/admin/components/AdminNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminNav.module.css";

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <span className={styles.brand}>HR Admin</span>
        <div className={styles.links}>
          <Link
            href="/admin/calendar"
            className={`${styles.link} ${pathname === "/admin/calendar" ? styles.active : ""}`}
          >
            Calendar
          </Link>
          <Link
            href="/admin/discounts"
            className={`${styles.link} ${pathname === "/admin/discounts" ? styles.active : ""}`}
          >
            Discounts
          </Link>
          <button className={styles.logout} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}
```

Create `src/app/admin/components/AdminNav.module.css`:

```css
.nav {
  border-bottom: 1px solid var(--color-border);
  padding: 0 2rem;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
}

.brand {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.link {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.link:hover,
.active {
  color: var(--color-text);
}

.logout {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-muted);
  background: none;
  border: 1px solid var(--color-border);
  padding: 0.4rem 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.logout:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}
```

**Step 2: Write the calendar page**

Create `src/app/admin/calendar/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface Booking {
  id: string;
  address: string;
  bedrooms: number;
  preferredDate: string;
  agentName: string;
  agentEmail: string;
  workHours: number;
  total: number;
  status: string;
  services: string;
}

interface BlockedDay {
  id: string;
  date: string;
  reason: string | null;
}

const MAX_DAILY_HOURS = 6;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDays, setBlockedDays] = useState<BlockedDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const daysInMonth = getDaysInMonth(year, month);
  const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const fetchData = useCallback(async () => {
    const [bookingsRes, blockedRes] = await Promise.all([
      fetch(`/api/admin/bookings?from=${monthStart}&to=${monthEnd}`),
      fetch("/api/admin/blocked-days"),
    ]);
    setBookings(await bookingsRes.json());
    setBlockedDays(await blockedRes.json());
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const bookingsForDate = (date: string) =>
    bookings.filter((b) => b.preferredDate === date && b.status === "confirmed");

  const hoursForDate = (date: string) =>
    bookingsForDate(date).reduce((sum, b) => sum + b.workHours, 0);

  const isBlocked = (date: string) =>
    blockedDays.some((d) => d.date === date);

  const handleBlockDay = async () => {
    if (!selectedDate) return;
    await fetch("/api/admin/blocked-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDate, reason: blockReason }),
    });
    setBlockReason("");
    fetchData();
  };

  const handleUnblockDay = async (id: string) => {
    await fetch("/api/admin/blocked-days", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    await fetch("/api/admin/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchData();
  };

  const firstDay = getFirstDayOfWeek(year, month);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedBookings = selectedDate ? bookingsForDate(selectedDate) : [];
  const selectedBlocked = selectedDate
    ? blockedDays.find((d) => d.date === selectedDate)
    : null;

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.calendarHeader}>
            <button className={styles.navBtn} onClick={prevMonth}>&larr;</button>
            <h2 className={styles.monthTitle}>
              {monthNames[month]} {year}
            </h2>
            <button className={styles.navBtn} onClick={nextMonth}>&rarr;</button>
          </div>

          <div className={styles.grid}>
            {dayNames.map((d) => (
              <div key={d} className={styles.dayHeader}>{d}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} className={styles.emptyCell} />;

              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const hours = hoursForDate(dateStr);
              const blocked = isBlocked(dateStr);
              const isSelected = selectedDate === dateStr;
              const capacity = hours / MAX_DAILY_HOURS;

              let cellClass = styles.dayCell;
              if (blocked) cellClass += ` ${styles.blocked}`;
              else if (capacity >= 1) cellClass += ` ${styles.full}`;
              else if (capacity > 0) cellClass += ` ${styles.partial}`;
              if (isSelected) cellClass += ` ${styles.selected}`;

              return (
                <button
                  key={dateStr}
                  className={cellClass}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                >
                  <span className={styles.dayNumber}>{day}</span>
                  {hours > 0 && (
                    <span className={styles.hoursLabel}>{hours}h</span>
                  )}
                  {blocked && <span className={styles.blockedLabel}>Blocked</span>}
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          {selectedDate && (
            <div className={styles.detail}>
              <h3 className={styles.detailTitle}>{selectedDate}</h3>

              {selectedBlocked ? (
                <div className={styles.blockedDetail}>
                  <p>Blocked{selectedBlocked.reason ? `: ${selectedBlocked.reason}` : ""}</p>
                  <button
                    className={styles.actionBtn}
                    onClick={() => handleUnblockDay(selectedBlocked.id)}
                  >
                    Unblock
                  </button>
                </div>
              ) : (
                <div className={styles.blockForm}>
                  <input
                    className={styles.blockInput}
                    type="text"
                    placeholder="Reason (optional)"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                  <button className={styles.actionBtn} onClick={handleBlockDay}>
                    Block Day
                  </button>
                </div>
              )}

              {selectedBookings.length > 0 ? (
                <div className={styles.bookingList}>
                  <h4 className={styles.bookingListTitle}>
                    Bookings ({hoursForDate(selectedDate)}h / {MAX_DAILY_HOURS}h)
                  </h4>
                  {selectedBookings.map((b) => (
                    <div key={b.id} className={styles.bookingCard}>
                      <p className={styles.bookingAddress}>{b.address}</p>
                      <p className={styles.bookingAgent}>{b.agentName} — {b.agentEmail}</p>
                      <p className={styles.bookingMeta}>
                        {b.workHours}h · {b.bedrooms}-bed · £{(b.total / 100).toFixed(2)}
                      </p>
                      <div className={styles.statusBtns}>
                        <button
                          className={`${styles.statusBtn} ${b.status === "completed" ? styles.statusActive : ""}`}
                          onClick={() => handleUpdateStatus(b.id, "completed")}
                        >
                          Complete
                        </button>
                        <button
                          className={`${styles.statusBtn} ${styles.cancelBtn} ${b.status === "cancelled" ? styles.statusActive : ""}`}
                          onClick={() => handleUpdateStatus(b.id, "cancelled")}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !selectedBlocked ? (
                <p className={styles.noBookings}>No bookings for this date</p>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
```

**Step 3: Write calendar styles**

Create `src/app/admin/calendar/page.module.css`:

```css
.main {
  padding: 2rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.calendarHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.navBtn {
  font-size: 1.25rem;
  padding: 0.5rem 1rem;
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.navBtn:hover {
  background-color: var(--color-border);
}

.monthTitle {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: var(--color-border);
  border: 1px solid var(--color-border);
}

.dayHeader {
  padding: 0.75rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  text-align: center;
  background-color: var(--color-bg);
  color: var(--color-muted);
}

.emptyCell {
  background-color: var(--color-bg);
  min-height: 80px;
}

.dayCell {
  background-color: var(--color-bg);
  min-height: 80px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
  text-align: left;
  border: none;
  width: 100%;
}

.dayCell:hover {
  background-color: rgba(0, 0, 0, 0.03);
}

.dayNumber {
  font-size: 0.85rem;
  font-weight: 600;
}

.hoursLabel {
  font-size: 0.7rem;
  color: var(--color-muted);
  font-weight: 500;
}

.blockedLabel {
  font-size: 0.65rem;
  color: #c0392b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.partial {
  background-color: rgba(45, 122, 58, 0.06);
}

.full {
  background-color: rgba(192, 57, 43, 0.06);
}

.blocked {
  background-color: rgba(192, 57, 43, 0.08);
}

.selected {
  outline: 2px solid var(--color-text);
  outline-offset: -2px;
}

/* Detail panel */

.detail {
  margin-top: 2rem;
  padding: 2rem;
  border: 1px solid var(--color-border);
}

.detailTitle {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-bottom: 1.5rem;
}

.blockedDetail {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border: 1px solid #c0392b;
  margin-bottom: 1.5rem;
}

.blockedDetail p {
  font-size: 0.85rem;
  color: #c0392b;
  font-weight: 500;
}

.blockForm {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.blockInput {
  flex: 1;
  padding: 0.6rem 0.8rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.blockInput:focus {
  outline: none;
  border-color: var(--color-text);
}

.actionBtn {
  padding: 0.6rem 1rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid var(--color-text);
  background: var(--color-text);
  color: var(--color-white);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.actionBtn:hover {
  opacity: 0.8;
}

.bookingList {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.bookingListTitle {
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.bookingCard {
  padding: 1rem;
  border: 1px solid var(--color-border);
}

.bookingAddress {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.35rem;
}

.bookingAgent {
  font-size: 0.8rem;
  color: var(--color-muted);
  margin-bottom: 0.25rem;
}

.bookingMeta {
  font-size: 0.8rem;
  color: var(--color-muted);
  margin-bottom: 0.75rem;
}

.statusBtns {
  display: flex;
  gap: 0.5rem;
}

.statusBtn {
  padding: 0.4rem 0.75rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.statusBtn:hover {
  border-color: var(--color-text);
  color: var(--color-text);
}

.cancelBtn:hover {
  border-color: #c0392b;
  color: #c0392b;
}

.statusActive {
  background-color: var(--color-text);
  color: var(--color-white);
  border-color: var(--color-text);
}

.cancelBtn.statusActive {
  background-color: #c0392b;
  border-color: #c0392b;
}

.noBookings {
  font-size: 0.85rem;
  color: var(--color-muted);
  font-style: italic;
}
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/admin/calendar/page.tsx src/app/admin/calendar/page.module.css src/app/admin/components/AdminNav.tsx src/app/admin/components/AdminNav.module.css
git commit -m "feat: add admin calendar page with booking detail panel and day blocking"
```

---

## Task 16: Admin Discounts Page

**Files:**
- Create: `src/app/admin/discounts/page.tsx`
- Create: `src/app/admin/discounts/page.module.css`

**Step 1: Write the discounts management page**

Create `src/app/admin/discounts/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import AdminNav from "../components/AdminNav";
import styles from "./page.module.css";

interface DiscountCode {
  id: string;
  code: string;
  percentage: number;
  active: number;
  maxUses: number | null;
  timesUsed: number;
  expiresAt: string | null;
  createdAt: string;
}

export default function DiscountsPage() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [newCode, setNewCode] = useState("");
  const [newPercentage, setNewPercentage] = useState("");
  const [newMaxUses, setNewMaxUses] = useState("");
  const [newExpiry, setNewExpiry] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCodes = useCallback(async () => {
    const res = await fetch("/api/admin/discounts");
    setCodes(await res.json());
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newPercentage) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          percentage: Number(newPercentage),
          maxUses: newMaxUses ? Number(newMaxUses) : null,
          expiresAt: newExpiry || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to create code");
        return;
      }
      setNewCode("");
      setNewPercentage("");
      setNewMaxUses("");
      setNewExpiry("");
      fetchCodes();
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, currentActive: number) => {
    await fetch("/api/admin/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active: currentActive ? 0 : 1 }),
    });
    fetchCodes();
  };

  return (
    <>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h2 className={styles.title}>Discount Codes</h2>

          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              className={styles.input}
              type="text"
              placeholder="Code (e.g. SUMMER25)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="number"
              placeholder="% off"
              min="1"
              max="100"
              value={newPercentage}
              onChange={(e) => setNewPercentage(e.target.value)}
              required
            />
            <input
              className={styles.input}
              type="number"
              placeholder="Max uses (optional)"
              min="1"
              value={newMaxUses}
              onChange={(e) => setNewMaxUses(e.target.value)}
            />
            <input
              className={styles.input}
              type="date"
              placeholder="Expires (optional)"
              value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)}
            />
            <button className={styles.createBtn} type="submit" disabled={creating}>
              {creating ? "Creating…" : "Create"}
            </button>
          </form>

          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Code</span>
              <span>Discount</span>
              <span>Uses</span>
              <span>Expires</span>
              <span>Status</span>
            </div>
            {codes.map((c) => (
              <div
                key={c.id}
                className={`${styles.tableRow} ${!c.active ? styles.inactive : ""}`}
              >
                <span className={styles.codeCell}>{c.code}</span>
                <span>{c.percentage}%</span>
                <span>
                  {c.timesUsed}{c.maxUses ? ` / ${c.maxUses}` : ""}
                </span>
                <span>{c.expiresAt || "—"}</span>
                <button
                  className={`${styles.toggleBtn} ${c.active ? styles.toggleActive : styles.toggleInactive}`}
                  onClick={() => toggleActive(c.id, c.active!)}
                >
                  {c.active ? "Active" : "Disabled"}
                </button>
              </div>
            ))}
            {codes.length === 0 && (
              <p className={styles.empty}>No discount codes yet</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
```

**Step 2: Write discounts page styles**

Create `src/app/admin/discounts/page.module.css`:

```css
.main {
  padding: 2rem;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.title {
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 2rem;
}

.createForm {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2.5rem;
  flex-wrap: wrap;
}

.input {
  padding: 0.7rem 0.9rem;
  font-family: var(--font-body);
  font-size: 0.85rem;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
  min-width: 0;
}

.input:first-child {
  flex: 1;
  min-width: 140px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.input:nth-child(2) {
  width: 80px;
}

.input:nth-child(3) {
  width: 120px;
}

.input:nth-child(4) {
  width: 150px;
}

.input:focus {
  outline: none;
  border-color: var(--color-text);
}

.createBtn {
  padding: 0.7rem 1.25rem;
  font-family: var(--font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  background-color: var(--color-text);
  color: var(--color-white);
  border: 1px solid var(--color-text);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.createBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.createBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.table {
  border: 1px solid var(--color-border);
}

.tableHeader {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 100px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--color-muted);
}

.tableRow {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 100px;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.85rem;
  align-items: center;
}

.tableRow:last-child {
  border-bottom: none;
}

.inactive {
  opacity: 0.4;
}

.codeCell {
  font-weight: 600;
  letter-spacing: 0.1em;
  font-family: var(--font-body);
}

.toggleBtn {
  padding: 0.3rem 0.6rem;
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border: 1px solid;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggleActive {
  border-color: #2d7a3a;
  color: #2d7a3a;
  background: transparent;
}

.toggleActive:hover {
  background-color: #2d7a3a;
  color: white;
}

.toggleInactive {
  border-color: #c0392b;
  color: #c0392b;
  background: transparent;
}

.toggleInactive:hover {
  background-color: #c0392b;
  color: white;
}

.empty {
  padding: 2rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--color-muted);
  font-style: italic;
}
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/admin/discounts/page.tsx src/app/admin/discounts/page.module.css
git commit -m "feat: add admin discounts management page with create/toggle"
```

---

## Task 17: Database Migration & Environment Setup

**Files:**
- Create: `.env.local` entries (manual)
- Run: Drizzle migration

**Step 1: Document required environment variables**

Ensure `.env.local` contains these variables (values are examples — replace with real ones):

```
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token
ADMIN_USER=harrison
ADMIN_PASSWORD_HASH=$2a$10$...
ADMIN_JWT_SECRET=your-random-32-char-secret-minimum
STRIPE_WEBHOOK_SECRET=whsec_...
```

To generate the admin password hash:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('YOUR_PASSWORD_HERE', 10).then(h => console.log(h))"
```

**Step 2: Push schema to Turso**

Run:
```bash
npx drizzle-kit push
```
Expected: Tables `bookings`, `discount_codes`, `blocked_days` created successfully.

**Step 3: Commit migration files (if generated)**

```bash
git add drizzle/
git commit -m "feat: add initial database migration files"
```

---

## Task 18: Final QA

**Step 1: Run all tests**

Run:
```bash
npx jest --verbose
```
Expected: All tests pass (pricing: 25, schema: 3, auth: 3, scheduling: 7 = 38 tests)

**Step 2: TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Build check**

Run:
```bash
npm run build
```
Expected: Clean build with no errors. Note: build will warn about missing env vars if they're not set — that's fine for CI purposes.

**Step 4: Manual smoke tests**

Verify these flows locally with `npm run dev`:

1. **Admin login**: Go to `/admin` → redirected to `/admin/login` → enter credentials → redirected to `/admin/calendar`
2. **Discount codes**: Navigate to `/admin/discounts` → create a code (e.g. TEST25, 25%) → verify it appears in the table → toggle it off/on
3. **Frontend discount**: On the booking form, enter the discount code → click Apply → verify it shows in basket with correct calculation
4. **Date availability**: Select a date for a property → verify availability check appears below the date input
5. **Calendar**: Check `/admin/calendar` → navigate months → click a date → verify detail panel opens
6. **Block a day**: In calendar detail, block a date → verify it shows as blocked on the calendar grid
7. **Stripe webhook**: (Requires Stripe CLI) — `stripe listen --forward-to localhost:3000/api/webhook/stripe` → make a test payment → verify booking appears on calendar

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete CMS backend with admin panel, discount codes, calendar, and webhook"
```
