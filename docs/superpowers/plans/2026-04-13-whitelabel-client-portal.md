# Whitelabel Client Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared-login client portal to the whitelabel deployment so Harrison's employer can see their bookings, start new bookings, and download past invoice PDFs. No database changes — credentials and employer identity come from env vars. Separate JWT cookie so whitelabel auth is disjoint from the main-site client portal.

**Architecture:** Reuse existing `/portal/*` paths, branching per-route via `isWhiteLabel()`. A new `src/lib/whitelabel-auth.ts` holds bcrypt + JWT helpers analogous to `client-auth.ts` but cookie-named `whitelabel_session` and signed with `WHITELABEL_JWT_SECRET`. `src/middleware.ts` gets a whitelabel branch for portal paths. Each portal API handler gains an `if (isWhiteLabel())` branch that reads company-wide whitelabel data instead of per-client rows. Agent prefill on `/book` already works via the existing `NEXT_PUBLIC_WL_AGENT_*` env vars and the `<AgentDetails />` render-guard in `BookingSection.tsx` — no changes needed there.

**Tech Stack:** Next.js 16 App Router · React 19 · Drizzle ORM · `jose` (JWT) · `bcryptjs` · existing whitelabel booking/invoice tables.

**Deviations from the spec:**
- Spec referred to `WHITELABEL_DEFAULT_AGENT_*` env vars for prefill. **Actual:** the codebase already uses `NEXT_PUBLIC_WL_AGENT_NAME/COMPANY/EMAIL/PHONE` via `BookingSection.tsx` lines 56–61. No new env vars for prefill, and no changes to `/book` in this plan.
- Spec mentioned locking the agent block read-only. **Actual:** `BookingSection.tsx` already conditionally hides `<AgentDetails />` entirely when `whiteLabel` is true (line 230). "Locked" by virtue of being invisible. No changes.

**File structure:**

- **New**
  - `src/lib/whitelabel-auth.ts` — bcrypt + JWT helpers for whitelabel session
  - `src/lib/__tests__/whitelabel-auth.test.ts`
  - `scripts/hash-password.mjs` — one-off CLI to print a bcrypt hash (Harrison runs this to produce `WHITELABEL_PORTAL_PASSWORD_HASH`)
  - `src/app/api/portal/whitelabel-invoice/[id]/pdf/route.ts` — portal-scoped PDF download (session-gated)
- **Modified**
  - `src/middleware.ts` — add whitelabel-session branch for `/portal/*` and `/api/portal/*`
  - `src/app/api/portal/login/route.ts` — brand-aware dispatch
  - `src/app/api/portal/logout/route.ts` — brand-aware cookie clear
  - `src/app/api/portal/dashboard/route.ts` — whitelabel branch returning company-wide stats
  - `src/app/api/portal/bookings/route.ts` — whitelabel branch returning all `bookings_whitelabel` rows
  - `src/app/api/portal/invoices/route.ts` — whitelabel branch returning uninvoiced total + invoice list (if route exists; else create GET handler)
  - `src/app/portal/login/page.tsx` — whitelabel variant (username field instead of email, hide signup link)
  - `src/app/portal/dashboard/page.tsx` — whitelabel variant (company tiles instead of client info)
  - `src/app/portal/bookings/page.tsx` — whitelabel variant (show all rows, no mandate warnings)
  - `src/app/portal/bookings/new/page.tsx` — on whitelabel, redirect straight to `/book`
  - `src/app/portal/invoices/page.tsx` — whitelabel variant
  - `src/app/portal/components/PortalNav.tsx` — hide Account link on whitelabel

Env vars required for whitelabel deployment (add to `.env.local`):

```
WHITELABEL_PORTAL_USERNAME=<e.g. employer>
WHITELABEL_PORTAL_PASSWORD_HASH=<bcrypt hash produced by scripts/hash-password.mjs>
WHITELABEL_JWT_SECRET=<64+ random chars>
# Existing — already used:
NEXT_PUBLIC_WL_AGENT_NAME=...
NEXT_PUBLIC_WL_AGENT_COMPANY=...
NEXT_PUBLIC_WL_AGENT_EMAIL=...
NEXT_PUBLIC_WL_AGENT_PHONE=...
WHITELABEL_INVOICE_COMPANY=...
WHITELABEL_INVOICE_ADDRESS_LINES=...
WHITELABEL_INVOICE_EMAIL=...
```

---

## Task 1: Whitelabel auth helper (TDD)

**Files:**
- Create: `src/lib/whitelabel-auth.ts`
- Create: `src/lib/__tests__/whitelabel-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/whitelabel-auth.test.ts`:

```ts
import {
  verifyWhitelabelPassword,
  createWhitelabelSessionToken,
  verifyWhitelabelSessionToken,
} from "../whitelabel-auth";
import { hash } from "bcryptjs";

describe("whitelabel-auth", () => {
  beforeEach(() => {
    process.env.WHITELABEL_JWT_SECRET = "test-secret-please-replace-with-a-real-long-one";
    process.env.WHITELABEL_PORTAL_USERNAME = "employer";
  });

  it("verifyWhitelabelPassword returns true for correct password", async () => {
    process.env.WHITELABEL_PORTAL_PASSWORD_HASH = await hash("hunter2", 12);
    expect(await verifyWhitelabelPassword("hunter2")).toBe(true);
  });

  it("verifyWhitelabelPassword returns false for wrong password", async () => {
    process.env.WHITELABEL_PORTAL_PASSWORD_HASH = await hash("hunter2", 12);
    expect(await verifyWhitelabelPassword("wrong")).toBe(false);
  });

  it("verifyWhitelabelPassword returns false when env hash missing", async () => {
    delete process.env.WHITELABEL_PORTAL_PASSWORD_HASH;
    expect(await verifyWhitelabelPassword("anything")).toBe(false);
  });

  it("signed session token verifies successfully", async () => {
    const token = await createWhitelabelSessionToken();
    const payload = await verifyWhitelabelSessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("employer");
  });

  it("tampered token fails verification", async () => {
    const token = await createWhitelabelSessionToken();
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifyWhitelabelSessionToken(tampered)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest whitelabel-auth.test.ts`
Expected: FAIL — `Cannot find module '../whitelabel-auth'`.

- [ ] **Step 3: Implement the helper**

Create `src/lib/whitelabel-auth.ts`:

```ts
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "whitelabel_session";
const SESSION_DURATION = 24 * 60 * 60; // 24h in seconds

function getSecret(): Uint8Array {
  const secret = process.env.WHITELABEL_JWT_SECRET;
  if (!secret) throw new Error("WHITELABEL_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface WhitelabelJWTPayload extends JWTPayload {
  sub: string; // username
}

export async function verifyWhitelabelPassword(submitted: string): Promise<boolean> {
  const hash = process.env.WHITELABEL_PORTAL_PASSWORD_HASH;
  if (!hash) return false;
  try {
    return await compare(submitted, hash);
  } catch {
    return false;
  }
}

export async function createWhitelabelSessionToken(): Promise<string> {
  const username = process.env.WHITELABEL_PORTAL_USERNAME || "employer";
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyWhitelabelSessionToken(
  token: string
): Promise<WhitelabelJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as WhitelabelJWTPayload;
  } catch {
    return null;
  }
}

export async function setWhitelabelSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearWhitelabelSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getWhitelabelSession(): Promise<WhitelabelJWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyWhitelabelSessionToken(token);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest whitelabel-auth.test.ts`
Expected: all 5 tests PASS.

Note: `src/lib/__mocks__/next-headers.ts` already exists and mocks `next/headers` for tests. No extra setup needed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/whitelabel-auth.ts src/lib/__tests__/whitelabel-auth.test.ts
git commit -m "feat(whitelabel-portal): auth helper (bcrypt + JWT session)"
```

---

## Task 2: Password hash generation script

**Files:**
- Create: `scripts/hash-password.mjs`

- [ ] **Step 1: Create the script**

```js
#!/usr/bin/env node
// Usage: node scripts/hash-password.mjs <password>
// Prints a bcrypt hash suitable for WHITELABEL_PORTAL_PASSWORD_HASH.

import { hash } from "bcryptjs";

const pw = process.argv[2];
if (!pw) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

const h = await hash(pw, 12);
console.log(h);
```

- [ ] **Step 2: Smoke test**

Run: `node scripts/hash-password.mjs testing123`
Expected: a single line like `$2b$12$...` printed to stdout. Verify with:

Run: `node -e "import('bcryptjs').then(b=>b.compare('testing123','$2b$12$REPLACE_WITH_OUTPUT').then(console.log))"`
Expected: `true`.

- [ ] **Step 3: Commit**

```bash
git add scripts/hash-password.mjs
git commit -m "feat(whitelabel-portal): script to generate bcrypt password hash"
```

---

## Task 3: Middleware — whitelabel portal branch

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Add whitelabel branch to portal gate**

Read `src/middleware.ts` first. The file currently has an admin branch and a portal branch; the portal branch always checks `client_session`. Replace the portal branch with brand-aware logic.

Replace the block from `// ── Portal auth ──` through the end of the portal `if` with:

```ts
  // ── Portal auth (brand-aware) ──
  if (PUBLIC_PORTAL_PATHS.includes(pathname)) return NextResponse.next();

  const isPortalPage = pathname.startsWith("/portal");
  const isPortalApi = pathname.startsWith("/api/portal");

  if (isPortalPage || isPortalApi) {
    const brandMode = process.env.NEXT_PUBLIC_BRAND_MODE || process.env.BRAND_MODE;
    const isWhitelabel = brandMode === "whitelabel";

    if (isWhitelabel) {
      const token = request.cookies.get("whitelabel_session")?.value;
      if (!token) {
        if (isPortalApi) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/portal/login", request.url));
      }
      try {
        const secret = process.env.WHITELABEL_JWT_SECRET;
        if (!secret) throw new Error("WHITELABEL_JWT_SECRET not set");
        await jwtVerify(token, new TextEncoder().encode(secret));
        return NextResponse.next();
      } catch {
        if (isPortalApi) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.redirect(new URL("/portal/login", request.url));
      }
    }

    // Main deployment — existing client_session behavior
    const token = request.cookies.get("client_session")?.value;
    if (!token) {
      if (isPortalApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
    try {
      await jwtVerify(token, getClientSecret());
      return NextResponse.next();
    } catch {
      if (isPortalApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/portal/login", request.url));
    }
  }
```

**Important:** the existing middleware calls `isWhiteLabel()` from `@/lib/brand` indirectly nowhere — it reads env directly. Continue to read env directly here (middleware runs in edge runtime; keep imports minimal).

- [ ] **Step 2: Extend public portal paths**

Signup endpoints must remain public on main but blocked on whitelabel. The cleanest: the whitelabel deployment simply has no UI linking to signup; if someone types `/portal/signup` they'll be redirected to login (middleware requires session). No change to `PUBLIC_PORTAL_PATHS` needed beyond what's there.

Verify `PUBLIC_PORTAL_PATHS` currently contains: `/portal/login`, `/portal/signup`, `/api/portal/login`, `/api/portal/signup`, `/api/portal/logout`. On whitelabel those stay "public" — the UI just never links to signup.

Actually, whitelabel signup must NOT be public or someone could create a client account via `/api/portal/signup` even though it's useless there. Tighten by filtering `PUBLIC_PORTAL_PATHS` at runtime when whitelabel:

Just before the `if (PUBLIC_PORTAL_PATHS.includes(pathname))` line add:

```ts
  const brandModeEnv = process.env.NEXT_PUBLIC_BRAND_MODE || process.env.BRAND_MODE;
  const isWhitelabelEnv = brandModeEnv === "whitelabel";

  const publicPaths = isWhitelabelEnv
    ? ["/portal/login", "/api/portal/login", "/api/portal/logout"]
    : PUBLIC_PORTAL_PATHS;
```

Then change the check to `if (publicPaths.includes(pathname)) return NextResponse.next();`.

This means on whitelabel: `/portal/signup`, `/api/portal/signup`, `/api/portal/signup-with-booking` all require auth — and since no one logs in there for signup, they 401/redirect.

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: builds without errors. Middleware compiles for edge runtime.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(whitelabel-portal): middleware branch for whitelabel session"
```

---

## Task 4: Brand-aware login API

**Files:**
- Modify: `src/app/api/portal/login/route.ts`

- [ ] **Step 1: Add whitelabel branch**

Read the existing file. Wrap the body in a brand check. Above the existing `try` block add:

```ts
import { isWhiteLabel } from "@/lib/brand";
import {
  verifyWhitelabelPassword,
  createWhitelabelSessionToken,
  setWhitelabelSessionCookie,
} from "@/lib/whitelabel-auth";
```

Then replace the existing `POST` function with:

```ts
export async function POST(request: Request) {
  if (isWhiteLabel()) {
    return handleWhitelabelLogin(request);
  }
  return handleMainLogin(request);
}

async function handleWhitelabelLogin(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const expectedUsername = process.env.WHITELABEL_PORTAL_USERNAME;
    if (!expectedUsername || username !== expectedUsername) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const valid = await verifyWhitelabelPassword(password);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = await createWhitelabelSessionToken();
    await setWhitelabelSessionCookie(token);

    return NextResponse.json({
      success: true,
      brand: "whitelabel",
      companyName: process.env.WHITELABEL_INVOICE_COMPANY || "",
    });
  } catch (err) {
    console.error("Whitelabel login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}

async function handleMainLogin(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const rows = await db
      .select()
      .from(clients)
      .where(eq(clients.email, email.toLowerCase()))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const client = rows[0];

    if (client.status === "deactivated") {
      return NextResponse.json(
        { error: "This account has been deactivated" },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, client.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createClientSessionToken(client.id, client.email);
    await setClientSessionCookie(token);

    return NextResponse.json({
      success: true,
      client: {
        id: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
        email: client.email,
        status: client.status,
        hasMandateSetup: !!client.gocardlessMandateId,
        bookingsPaused: !!client.bookingsPaused,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portal/login/route.ts
git commit -m "feat(whitelabel-portal): login API brand-aware"
```

---

## Task 5: Brand-aware logout API

**Files:**
- Modify: `src/app/api/portal/logout/route.ts`

- [ ] **Step 1: Read current logout route**

Open the file. It currently calls `clearClientSessionCookie()`.

- [ ] **Step 2: Add whitelabel branch**

Replace the body with:

```ts
import { NextResponse } from "next/server";
import { clearClientSessionCookie } from "@/lib/client-auth";
import { clearWhitelabelSessionCookie } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

export async function POST() {
  if (isWhiteLabel()) {
    await clearWhitelabelSessionCookie();
  } else {
    await clearClientSessionCookie();
  }
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/logout/route.ts
git commit -m "feat(whitelabel-portal): logout API brand-aware"
```

---

## Task 6: Brand-aware dashboard API

**Files:**
- Modify: `src/app/api/portal/dashboard/route.ts`

- [ ] **Step 1: Add whitelabel branch**

The existing handler queries client-specific data. Wrap with a brand check and return company-wide whitelabel data on whitelabel.

Full new file content:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices, bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";

export async function GET() {
  if (isWhiteLabel()) {
    return handleWhitelabelDashboard();
  }
  return handleMainDashboard();
}

async function handleWhitelabelDashboard() {
  const session = await getWhitelabelSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const upcoming = await db
    .select({ count: sql<number>`count(*)` })
    .from(bookingsWhitelabel)
    .where(
      and(
        sql`${bookingsWhitelabel.preferredDate} >= ${today}`,
        eq(bookingsWhitelabel.status, "confirmed"),
      )
    );

  const uninvoiced = await db
    .select({ total: sql<number>`coalesce(sum(${bookingsWhitelabel.total}), 0)` })
    .from(bookingsWhitelabel)
    .where(isNull(bookingsWhitelabel.whitelabelInvoiceId));

  const latest = await db
    .select()
    .from(whitelabelInvoices)
    .orderBy(desc(whitelabelInvoices.generatedAt))
    .limit(1);

  return NextResponse.json({
    brand: "whitelabel",
    companyName: process.env.WHITELABEL_INVOICE_COMPANY || "",
    upcomingCount: upcoming[0]?.count ?? 0,
    uninvoicedTotal: uninvoiced[0]?.total ?? 0,
    lastInvoiceAt: latest[0]?.generatedAt ?? null,
    lastInvoiceNumber: latest[0]?.invoiceNumber ?? null,
  });
}

async function handleMainDashboard() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = session.sub;

  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  const completedBookings = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${bookings.total}), 0)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "completed"))
    );

  const pendingBookings = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "pending"))
    );

  const paidInvoices = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.clientId, clientId), eq(invoices.status, "paid"))
    );

  return NextResponse.json({
    brand: "main",
    client: {
      id: client.id,
      companyName: client.companyName,
      contactName: client.contactName,
      email: client.email,
      status: client.status,
      hasMandateSetup: !!client.gocardlessMandateId,
      bookingsPaused: !!client.bookingsPaused,
    },
    runningTotal: completedBookings[0]?.total ?? 0,
    completedShootCount: completedBookings[0]?.count ?? 0,
    pendingShootCount: pendingBookings[0]?.count ?? 0,
    totalPaidToDate: paidInvoices[0]?.total ?? 0,
  });
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portal/dashboard/route.ts
git commit -m "feat(whitelabel-portal): dashboard API brand-aware"
```

---

## Task 7: Brand-aware bookings API

**Files:**
- Modify: `src/app/api/portal/bookings/route.ts`

- [ ] **Step 1: Inspect current file**

Read it. It has both GET (list client's bookings) and POST (create booking). Keep both main-only. Add whitelabel GET that returns all whitelabel bookings. POST on whitelabel returns 404 (they use the public `/book` flow, not this endpoint).

- [ ] **Step 2: Modify**

Replace the GET export:

```ts
export async function GET() {
  if (isWhiteLabel()) {
    const session = await getWhitelabelSession();
    if (!session?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const rows = await db
      .select()
      .from(bookingsWhitelabel)
      .orderBy(desc(bookingsWhitelabel.preferredDate));
    return NextResponse.json(rows);
  }

  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.clientId, session.sub))
    .orderBy(bookings.preferredDate);

  return NextResponse.json(rows);
}
```

Add the new imports at the top:

```ts
import { bookingsWhitelabel } from "@/lib/schema";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";
import { desc } from "drizzle-orm";
```

Keep the existing POST handler, but add at its very top:

```ts
  if (isWhiteLabel()) {
    return NextResponse.json({ error: "Not available on whitelabel" }, { status: 404 });
  }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/bookings/route.ts
git commit -m "feat(whitelabel-portal): bookings API brand-aware"
```

---

## Task 8: Brand-aware invoices API + portal PDF route

**Files:**
- Modify: `src/app/api/portal/invoices/route.ts`
- Create: `src/app/api/portal/whitelabel-invoice/[id]/pdf/route.ts`

- [ ] **Step 1: Inspect current invoices route**

Read `src/app/api/portal/invoices/route.ts`. Note its response shape for the main flow.

- [ ] **Step 2: Add whitelabel GET branch**

At the top of the file, add:

```ts
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { isWhiteLabel } from "@/lib/brand";
import { isNull, desc } from "drizzle-orm";
```

At the top of the existing `GET` handler, insert:

```ts
  if (isWhiteLabel()) {
    const session = await getWhitelabelSession();
    if (!session?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [uninvoiced, past] = await Promise.all([
      db
        .select({ total: sql<number>`coalesce(sum(${bookingsWhitelabel.total}), 0)` })
        .from(bookingsWhitelabel)
        .where(isNull(bookingsWhitelabel.whitelabelInvoiceId)),
      db
        .select()
        .from(whitelabelInvoices)
        .orderBy(desc(whitelabelInvoices.generatedAt)),
    ]);

    return NextResponse.json({
      brand: "whitelabel",
      uninvoicedTotal: uninvoiced[0]?.total ?? 0,
      invoices: past,
    });
  }
```

Leave the main-site behavior below unchanged.

If the existing file doesn't import `sql`, add it to the drizzle imports.

- [ ] **Step 3: Create portal-scoped PDF route**

Create `src/app/api/portal/whitelabel-invoice/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel, whitelabelInvoices } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { generateWhitelabelInvoicePdf, readBillToFromEnv } from "@/lib/whitelabel-invoice-pdf";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getWhitelabelSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = (
    await db.select().from(whitelabelInvoices).where(eq(whitelabelInvoices.id, id))
  )[0];
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

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/invoices/route.ts src/app/api/portal/whitelabel-invoice/
git commit -m "feat(whitelabel-portal): invoices API + portal-scoped PDF route"
```

---

## Task 9: Login page — whitelabel variant

**Files:**
- Modify: `src/app/portal/login/page.tsx`

- [ ] **Step 1: Add whitelabel branch**

The file is a client component. Add a branch that uses `username` instead of `email` and hides the signup link when `isWhiteLabel()`. The existing main-site flow stays intact.

Minimal changes:

1. Replace the `email` state + input with conditional fields:

   ```tsx
   const whitelabel = isWhiteLabel();
   const [username, setUsername] = useState("");
   const [email, setEmail] = useState("");
   ```

2. In `handleSubmit`, branch:

   ```tsx
   const body = whitelabel
     ? { username, password }
     : { email, password };

   const res = await fetch("/api/portal/login", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify(body),
   });
   ```

3. On success, whitelabel goes straight to dashboard; no mandate-setup redirect:

   ```tsx
   if (data.brand === "whitelabel") {
     router.push("/portal/dashboard");
     return;
   }
   // existing main-site redirect logic unchanged
   ```

4. Replace the email input block with:

   ```tsx
   {whitelabel ? (
     <label className={styles.label}>
       <span className={styles.labelText}>Username</span>
       <input
         className={`${styles.input} ${error ? styles.inputError : ""}`}
         type="text"
         value={username}
         onChange={(e) => { setUsername(e.target.value); if (error) setError(""); }}
         placeholder="Your username"
         required
         autoFocus
       />
     </label>
   ) : (
     <label className={styles.label}>
       <span className={styles.labelText}>Email Address</span>
       <input
         className={`${styles.input} ${error ? styles.inputError : ""}`}
         type="email"
         value={email}
         onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
         placeholder="james@foxtons.co.uk"
         required
         autoFocus
       />
     </label>
   )}
   ```

5. Hide the "Don't have an account? Sign up" header on whitelabel:

   ```tsx
   {!whitelabel && (
     <div className={styles.formHeader}>
       <span className={styles.formHeaderText}>Don&apos;t have an account?</span>
       <Link href="/portal/signup" className={styles.signUpLink}>Sign up</Link>
     </div>
   )}
   ```

6. Keep the existing `!isWhiteLabel() &&` guard on the logo link in the image panel — already present at line ~87.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/login/page.tsx
git commit -m "feat(whitelabel-portal): login page username field on whitelabel"
```

---

## Task 10: Dashboard page — whitelabel variant

**Files:**
- Modify: `src/app/portal/dashboard/page.tsx`

- [ ] **Step 1: Add whitelabel variant**

Top of the file, import `isWhiteLabel`:

```tsx
import { isWhiteLabel } from "@/lib/brand";
```

Extend the state type to cover both shapes. Simpler: keep two separate state types and branch the render.

Add a new interface:

```tsx
interface WhitelabelDashboardData {
  brand: "whitelabel";
  companyName: string;
  upcomingCount: number;
  uninvoicedTotal: number;
  lastInvoiceAt: string | null;
  lastInvoiceNumber: string | null;
}
```

Change the state type to `DashboardData | WhitelabelDashboardData | null`.

After the existing loading guard, branch:

```tsx
if (data && "brand" in data && data.brand === "whitelabel") {
  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.titleArea}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.companyLabel}>{data.companyName}</p>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Upcoming shoots</div>
              <div className={styles.statValue}>{data.upcomingCount}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Un-invoiced total</div>
              <div className={styles.statValue}>{pence(data.uninvoicedTotal)}</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statLabel}>Last invoice</div>
              <div className={styles.statValue}>
                {data.lastInvoiceAt
                  ? new Date(data.lastInvoiceAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                  : "—"}
              </div>
              {data.lastInvoiceNumber && (
                <div className={styles.statMeta}>{data.lastInvoiceNumber}</div>
              )}
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Link href="/book" className={styles.primaryBtn}>New Booking</Link>
            <Link href="/portal/bookings" className={styles.secondaryBtn}>View Bookings</Link>
            <Link href="/portal/invoices" className={styles.secondaryBtn}>View Invoices</Link>
          </div>
        </div>
      </main>
    </>
  );
}
```

Leave the main branch below unchanged.

Check `page.module.css` — if `statsGrid`, `statCard`, `statLabel`, `statValue`, `statMeta`, `actionsRow`, `primaryBtn`, `secondaryBtn` don't exist, add them. Add this block to `src/app/portal/dashboard/page.module.css`:

```css
.statsGrid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin: 24px 0 32px;
}
.statCard {
  border: 1px solid #e7e3de;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
}
.statLabel {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8a857f;
  font-weight: 600;
  margin-bottom: 8px;
}
.statValue {
  font-size: 28px;
  font-weight: 700;
  color: #0a0a0a;
}
.statMeta {
  font-size: 12px;
  color: #8a857f;
  margin-top: 4px;
}
.actionsRow {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
}
.primaryBtn {
  background: #0a0a0a;
  color: #fff;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
.secondaryBtn {
  background: #fff;
  color: #0a0a0a;
  border: 1px solid #0a0a0a;
  padding: 10px 20px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}
```

If any of those class names already exist in the CSS, skip duplicates — don't redefine them.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/dashboard/page.tsx src/app/portal/dashboard/page.module.css
git commit -m "feat(whitelabel-portal): dashboard page with company stats"
```

---

## Task 11: Bookings page — whitelabel variant

**Files:**
- Modify: `src/app/portal/bookings/page.tsx`

- [ ] **Step 1: Read the current file**

See what fields it renders per booking and how it handles the "no mandate" / "pending approval" banners.

- [ ] **Step 2: Add whitelabel branch**

At the top of the rendered component, if `isWhiteLabel()`, render a simpler table. The existing `bookings` endpoint now returns `bookings_whitelabel` rows (which have no `clientId`, no `stripeSession`) — the existing render should mostly work, but remove any client-mandate–specific banners.

Simplest approach: add `const whitelabel = isWhiteLabel();` and wrap any mandate-banner JSX with `{!whitelabel && ...}`. Column set (date, address, status, total) is already shown.

If there are main-only actions (e.g. "Set up mandate", "Pay now"), hide them behind `!whitelabel`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/bookings/page.tsx
git commit -m "feat(whitelabel-portal): bookings list on whitelabel hides mandate CTAs"
```

---

## Task 12: Bookings/new — redirect to /book on whitelabel

**Files:**
- Modify: `src/app/portal/bookings/new/page.tsx`

- [ ] **Step 1: Add redirect at top**

This is a client component. At the very top of the render function, short-circuit on whitelabel:

```tsx
import { isWhiteLabel } from "@/lib/brand";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
// ...existing imports stay

export default function NewBookingPage() {
  const router = useRouter();
  const whitelabel = isWhiteLabel();

  useEffect(() => {
    if (whitelabel) router.replace("/book");
  }, [whitelabel, router]);

  if (whitelabel) {
    return (
      <main style={{ padding: 40 }}>
        <p>Redirecting to booking form…</p>
      </main>
    );
  }

  // existing client component body unchanged below
```

Don't touch anything else in the file.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/bookings/new/page.tsx
git commit -m "feat(whitelabel-portal): /portal/bookings/new redirects to /book on whitelabel"
```

---

## Task 13: Invoices page — whitelabel variant

**Files:**
- Modify: `src/app/portal/invoices/page.tsx`

- [ ] **Step 1: Read current file**

See the existing shape.

- [ ] **Step 2: Add whitelabel branch**

Add `isWhiteLabel()` guard at top. If whitelabel, fetch `/api/portal/invoices` and render the new response shape `{ uninvoicedTotal, invoices: [...] }`. Each invoice row links to `/api/portal/whitelabel-invoice/{id}/pdf` for download.

Pattern — add before the existing fetch logic:

```tsx
interface WhitelabelInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  bookingCount: number;
  generatedAt: string | null;
}

interface WhitelabelInvoicesResponse {
  brand: "whitelabel";
  uninvoicedTotal: number;
  invoices: WhitelabelInvoice[];
}
```

Branch the render:

```tsx
if (whitelabel && data && "brand" in data && data.brand === "whitelabel") {
  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Invoices</h1>

          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Un-invoiced total</div>
            <div className={styles.summaryValue}>{pence(data.uninvoicedTotal)}</div>
            <div className={styles.summaryNote}>
              This is the running total of confirmed shoots not yet invoiced.
            </div>
          </div>

          <h2 className={styles.subheading}>Past invoices</h2>
          {data.invoices.length === 0 ? (
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
                {data.invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber}</td>
                    <td>
                      {inv.generatedAt
                        ? new Date(inv.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td>{inv.bookingCount}</td>
                    <td style={{ textAlign: "right" }}>{pence(inv.totalAmount)}</td>
                    <td><a href={`/api/portal/whitelabel-invoice/${inv.id}/pdf`}>Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
```

Ensure `pence()` helper is available; copy it inline if needed:

```tsx
function pence(n: number): string {
  return `£${(n / 100).toFixed(2)}`;
}
```

Append CSS if not already present:

```css
.summaryCard {
  border: 1px solid #e7e3de;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
  margin-bottom: 32px;
}
.summaryLabel {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8a857f;
  font-weight: 600;
  margin-bottom: 8px;
}
.summaryValue {
  font-size: 32px;
  font-weight: 700;
  color: #0a0a0a;
}
.summaryNote {
  font-size: 13px;
  color: #8a857f;
  margin-top: 8px;
}
.subheading {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
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
.empty {
  color: #8a857f;
  font-size: 14px;
  margin: 0;
}
```

Skip duplicates if any of these classes already exist in the file.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/portal/invoices/page.tsx src/app/portal/invoices/page.module.css
git commit -m "feat(whitelabel-portal): invoices page with un-invoiced total and PDF downloads"
```

---

## Task 14: Portal nav — hide Account on whitelabel

**Files:**
- Modify: `src/app/portal/components/PortalNav.tsx`

- [ ] **Step 1: Wrap Account link**

In the `PortalNav` render, wrap the Account link with `{!isWhiteLabel() && ...}`:

```tsx
{!isWhiteLabel() && (
  <Link
    href="/portal/account"
    className={`${styles.link} ${pathname?.startsWith("/portal/account") ? styles.active : ""}`}
  >
    Account
  </Link>
)}
```

`isWhiteLabel` is already imported at line 5 of that file.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/components/PortalNav.tsx
git commit -m "feat(whitelabel-portal): hide Account nav link on whitelabel"
```

---

## Task 15: Final verification

- [ ] **Step 1: Type + test + build**

```
npx tsc --noEmit
npx jest
npx next build
```

Expected: no new errors anywhere. `whitelabel-auth.test.ts` passes. Pre-existing failing suites (`pricing.test.ts`, `scheduling.test.ts`) remain unchanged. Build lists the new `/api/portal/whitelabel-invoice/[id]/pdf` route.

- [ ] **Step 2: Manual whitelabel portal smoke test**

Set env vars in `.env.local`:

```
WHITELABEL_PORTAL_USERNAME=employer
WHITELABEL_PORTAL_PASSWORD_HASH=<run: node scripts/hash-password.mjs testing123>
WHITELABEL_JWT_SECRET=<any long random string>
```

Restart the whitelabel dev server:

```bash
NEXT_PUBLIC_BRAND_MODE=whitelabel BRAND_MODE=whitelabel npm run dev -- --port 3100
```

Navigate to `http://localhost:3100/portal/login`. Enter `employer` / `testing123`. Verify:
- Login succeeds, redirects to dashboard.
- Dashboard shows company name + three tiles.
- Bookings list shows whitelabel bookings only.
- Invoices page shows un-invoiced total + past invoice rows with working Download links.
- "New Booking" link lands on `/book` which hides the agent form and uses `WL_AGENT` values.
- Log Out button clears session and redirects to login.
- Hitting `/portal/signup` while logged out redirects to login (middleware blocks it on whitelabel).

- [ ] **Step 3: Manual main site smoke test (regression)**

On the main dev server (`npm run dev` default port 3000), log into an existing main client account (or create one via `/portal/signup`). Verify:
- Login still works with email + password.
- Dashboard shows client-specific stats unchanged.
- Bookings, invoices, account pages render as before.
- Mandate banners / pending-approval banners still appear.

- [ ] **Step 4: If both pass, note any follow-ups and stop**

No further commits needed. Plan complete.
