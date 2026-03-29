# Account Clients & Monthly Invoicing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a B2B account layer with GoCardless Direct Debit invoicing for estate agent clients, alongside the existing Stripe one-off booking flow.

**Architecture:** Extend the existing Next.js app with new DB tables (clients, invoices, invoice_items), a client portal at `/portal/*` with its own JWT auth, GoCardless integration for mandate setup and payment collection, and admin client management at `/admin/clients`. The existing Stripe flow is untouched.

**Tech Stack:** Next.js 16, Drizzle ORM + Turso, GoCardless Node.js SDK, bcryptjs, jose (JWT), Resend (email), pdf-lib (invoices)

---

## File Structure

### New files
- `src/lib/schema.ts` — modify: add `clients`, `invoices`, `invoice_items` tables + `clientId` column on `bookings`
- `src/lib/client-auth.ts` — client JWT session management (mirrors `auth.ts` pattern)
- `src/lib/gocardless.ts` — GoCardless client singleton + helper functions
- `src/lib/client-emails.ts` — email templates for account client notifications
- `src/lib/account-invoice-pdf.ts` — cumulative multi-shoot PDF invoice generation
- `src/middleware.ts` — modify: add portal auth context
- `src/app/portal/login/page.tsx` — client login page
- `src/app/portal/login/page.module.css` — login styles
- `src/app/portal/signup/page.tsx` — client registration page
- `src/app/portal/signup/page.module.css` — signup styles
- `src/app/portal/layout.tsx` — portal layout with nav
- `src/app/portal/components/PortalNav.tsx` — portal navigation component
- `src/app/portal/components/PortalNav.module.css` — portal nav styles
- `src/app/portal/dashboard/page.tsx` — dashboard with running total + stats
- `src/app/portal/dashboard/page.module.css` — dashboard styles
- `src/app/portal/bookings/page.tsx` — booking list with filters
- `src/app/portal/bookings/page.module.css` — bookings list styles
- `src/app/portal/bookings/new/page.tsx` — new booking form (adapted from BookingSection)
- `src/app/portal/bookings/new/page.module.css` — new booking styles
- `src/app/portal/invoices/page.tsx` — invoice list with breakdowns
- `src/app/portal/invoices/page.module.css` — invoice styles
- `src/app/portal/account/page.tsx` — account settings
- `src/app/portal/account/page.module.css` — account styles
- `src/app/portal/account/setup-mandate/page.tsx` — GoCardless mandate setup
- `src/app/portal/account/setup-mandate/page.module.css` — mandate setup styles
- `src/app/api/portal/signup/route.ts` — client registration
- `src/app/api/portal/login/route.ts` — client authentication
- `src/app/api/portal/logout/route.ts` — client session clear
- `src/app/api/portal/dashboard/route.ts` — running total + stats
- `src/app/api/portal/bookings/route.ts` — list + create bookings
- `src/app/api/portal/invoices/route.ts` — list invoices
- `src/app/api/portal/invoices/[id]/pdf/route.ts` — download invoice PDF
- `src/app/api/portal/account/route.ts` — get/update account
- `src/app/api/portal/account/change-password/route.ts` — change password
- `src/app/api/portal/account/setup-mandate/route.ts` — initiate GoCardless mandate
- `src/app/api/portal/account/mandate-status/route.ts` — check mandate status
- `src/app/api/admin/clients/route.ts` — list clients
- `src/app/api/admin/clients/[id]/route.ts` — client detail + status updates
- `src/app/api/admin/clients/[id]/charge/route.ts` — charge client
- `src/app/api/admin/invoices/[id]/retry/route.ts` — retry failed payment
- `src/app/api/webhook/gocardless/route.ts` — GoCardless webhooks
- `src/app/admin/clients/page.tsx` — admin clients list page
- `src/app/admin/clients/page.module.css` — clients list styles
- `src/app/admin/clients/[id]/page.tsx` — admin client detail page
- `src/app/admin/clients/[id]/page.module.css` — client detail styles

### Modified files
- `src/lib/schema.ts` — add 3 new tables, add `clientId` to bookings
- `src/middleware.ts` — add portal auth
- `src/app/admin/components/AdminNav.tsx` — add "Clients" link
- `src/app/api/admin/bookings/route.ts` — expand valid statuses, join client name
- `src/app/admin/bookings/page.tsx` — add new statuses to filters, show client name
- `src/app/admin/calendar/page.tsx` — add visual indicator for account bookings
- `package.json` — add `gocardless-nodejs` dependency

---

## Task 1: Install GoCardless and update schema

**Files:**
- Modify: `package.json`
- Modify: `src/lib/schema.ts`

- [ ] **Step 1: Install GoCardless SDK**

```bash
npm install gocardless-nodejs
```

- [ ] **Step 2: Update database schema with new tables and columns**

Add the following to `src/lib/schema.ts` after the existing table definitions:

```typescript
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("pending_approval"),
  gocardlessMandateId: text("gocardless_mandate_id"),
  gocardlessCustomerId: text("gocardless_customer_id"),
  bookingsPaused: integer("bookings_paused").notNull().default(0),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  clientId: text("client_id").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: text("status").notNull().default("pending"),
  gocardlessPaymentId: text("gocardless_payment_id"),
  pdfPath: text("pdf_path"),
  failureReason: text("failure_reason"),
  chargedAt: text("charged_at"),
  paidAt: text("paid_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const invoiceItems = sqliteTable("invoice_items", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull(),
  bookingId: text("booking_id").notNull(),
  amount: integer("amount").notNull(),
});
```

- [ ] **Step 3: Add clientId column to existing bookings table**

In the `bookings` table definition in `src/lib/schema.ts`, add after the `status` field:

```typescript
  clientId: text("client_id"),
```

- [ ] **Step 4: Generate and run the migration**

```bash
npm run db:generate
npm run db:push
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/schema.ts drizzle/
git commit -m "feat: add clients, invoices, invoice_items tables and GoCardless dependency"
```

---

## Task 2: Client authentication library

**Files:**
- Create: `src/lib/client-auth.ts`

- [ ] **Step 1: Create client auth module**

Create `src/lib/client-auth.ts`:

```typescript
import { hash, compare } from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "client_session";
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days

function getSecret() {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret) throw new Error("CLIENT_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export interface ClientJWTPayload extends JWTPayload {
  sub: string; // clientId
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return compare(password, passwordHash);
}

export async function createClientSessionToken(
  clientId: string,
  email: string
): Promise<string> {
  return new SignJWT({ sub: clientId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSecret());
}

export async function verifyClientSessionToken(
  token: string
): Promise<ClientJWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as ClientJWTPayload;
  } catch {
    return null;
  }
}

export async function setClientSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION,
    path: "/",
  });
}

export async function clearClientSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getClientSession(): Promise<ClientJWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyClientSessionToken(token);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/client-auth.ts
git commit -m "feat: add client JWT authentication library"
```

---

## Task 3: Update middleware for portal auth

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Update middleware to handle both admin and portal auth**

Replace the entire contents of `src/middleware.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

function getAdminSecret() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) throw new Error("ADMIN_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

function getClientSecret() {
  const secret = process.env.CLIENT_JWT_SECRET;
  if (!secret) throw new Error("CLIENT_JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

const PUBLIC_PORTAL_PATHS = [
  "/portal/login",
  "/portal/signup",
  "/api/portal/login",
  "/api/portal/signup",
  "/api/portal/logout",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Admin auth (existing) ──
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/login") return NextResponse.next();
  if (pathname === "/api/admin/logout") return NextResponse.next();

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get("admin_session")?.value;
    if (!token) {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    try {
      await jwtVerify(token, getAdminSecret());
      return NextResponse.next();
    } catch {
      if (isAdminApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // ── Portal auth ──
  if (PUBLIC_PORTAL_PATHS.includes(pathname)) return NextResponse.next();

  const isPortalPage = pathname.startsWith("/portal");
  const isPortalApi = pathname.startsWith("/api/portal");

  if (isPortalPage || isPortalApi) {
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

  // ── GoCardless webhook (public) ──
  // No auth needed — signature verified in the handler

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/portal/:path*", "/api/portal/:path*"],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add portal auth context to middleware"
```

---

## Task 4: GoCardless client library

**Files:**
- Create: `src/lib/gocardless.ts`

- [ ] **Step 1: Create GoCardless helper module**

Create `src/lib/gocardless.ts`:

```typescript
import { GoCardlessClient, Environments } from "gocardless-nodejs";
import constants from "gocardless-nodejs/constants";

let _client: GoCardlessClient | null = null;

export function getGoCardlessClient(): GoCardlessClient {
  if (!_client) {
    const accessToken = process.env.GOCARDLESS_ACCESS_TOKEN;
    if (!accessToken) throw new Error("GOCARDLESS_ACCESS_TOKEN not set");

    const environment =
      process.env.GOCARDLESS_ENVIRONMENT === "live"
        ? Environments.Live
        : Environments.Sandbox;

    _client = new GoCardlessClient(accessToken, environment);
  }
  return _client;
}

/**
 * Create a billing request flow for mandate setup.
 * Returns the authorisation URL to embed in the drop-in component.
 */
export async function createBillingRequestFlow(
  clientEmail: string,
  clientName: string,
  companyName: string
): Promise<{ billingRequestFlowId: string; authorisationUrl: string }> {
  const gc = getGoCardlessClient();

  // Create a billing request for mandate-only setup
  const billingRequest = await gc.billingRequests.create({
    mandate_request: {
      scheme: "bacs",
    },
  });

  // Create the flow with prefilled customer details
  const flow = await gc.billingRequestFlows.create({
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/portal/account/setup-mandate?success=true`,
    exit_uri: `${process.env.NEXT_PUBLIC_APP_URL}/portal/account`,
    links: {
      billing_request: billingRequest.id!,
    },
    prefilled_customer: {
      email: clientEmail,
      given_name: clientName.split(" ")[0],
      family_name: clientName.split(" ").slice(1).join(" ") || clientName,
      company_name: companyName,
    },
  });

  return {
    billingRequestFlowId: flow.id!,
    authorisationUrl: flow.authorisation_url!,
  };
}

/**
 * Create a payment against a mandate.
 * Amount is in pence (GBP).
 */
export async function createPayment(
  mandateId: string,
  amountPence: number,
  description: string,
  invoiceId: string
): Promise<string> {
  const gc = getGoCardlessClient();

  const payment = await gc.payments.create({
    amount: amountPence,
    currency: "GBP",
    links: {
      mandate: mandateId,
    },
    description,
    metadata: {
      invoice_id: invoiceId,
    },
  });

  return payment.id!;
}

/**
 * Cancel a pending payment.
 */
export async function cancelPayment(paymentId: string): Promise<void> {
  const gc = getGoCardlessClient();
  await gc.payments.cancel(paymentId);
}

/**
 * Get mandate details to check status.
 */
export async function getMandate(mandateId: string) {
  const gc = getGoCardlessClient();
  return gc.mandates.get(mandateId);
}

/**
 * Verify a GoCardless webhook signature.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const crypto = require("crypto");
  const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
  if (!secret) throw new Error("GOCARDLESS_WEBHOOK_SECRET not set");

  const computedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/gocardless.ts
git commit -m "feat: add GoCardless client library with mandate and payment helpers"
```

---

## Task 5: Client portal API routes — Auth (signup, login, logout)

**Files:**
- Create: `src/app/api/portal/signup/route.ts`
- Create: `src/app/api/portal/login/route.ts`
- Create: `src/app/api/portal/logout/route.ts`

- [ ] **Step 1: Create signup API route**

Create `src/app/api/portal/signup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/client-auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const HARRISON_EMAIL = "harrison@thepropertyroom.co";

export async function POST(request: Request) {
  try {
    const { companyName, contactName, email, phone, password } =
      await request.json();

    if (!companyName || !contactName || !email || !phone || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    await db.insert(clients).values({
      id: crypto.randomUUID(),
      companyName,
      contactName,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      status: "pending_approval",
    });

    // Notify Harrison
    await resend.emails.send({
      from: "Harrison <harrison@thepropertyroom.co>",
      to: HARRISON_EMAIL,
      subject: `New Account Pending Approval: ${companyName}`,
      html: `
        <h2>New Account Registration</h2>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Contact:</strong> ${contactName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p>Log in to the admin panel to approve this account.</p>
      `,
    }).catch((err) => console.error("Failed to send signup notification:", err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create login API route**

Create `src/app/api/portal/login/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  createClientSessionToken,
  setClientSessionCookie,
} from "@/lib/client-auth";

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create logout API route**

Create `src/app/api/portal/logout/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { clearClientSessionCookie } from "@/lib/client-auth";

export async function POST() {
  await clearClientSessionCookie();
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/signup/route.ts src/app/api/portal/login/route.ts src/app/api/portal/logout/route.ts
git commit -m "feat: add portal auth API routes (signup, login, logout)"
```

---

## Task 6: Client portal pages — Login & Signup

**Files:**
- Create: `src/app/portal/login/page.tsx`
- Create: `src/app/portal/login/page.module.css`
- Create: `src/app/portal/signup/page.tsx`
- Create: `src/app/portal/signup/page.module.css`

- [ ] **Step 1: Create login page**

Create `src/app/portal/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";

export default function ClientLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.client.status === "pending_approval") {
        router.push("/portal/dashboard");
      } else if (!data.client.hasMandateSetup) {
        router.push("/portal/account/setup-mandate");
      } else {
        router.push("/portal/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Client Portal</h1>
        <p className={styles.subtitle}>Sign in to manage your bookings</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className={styles.footer}>
          Don&apos;t have an account?{" "}
          <Link href="/portal/signup" className={styles.link}>
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create login page styles**

Create `src/app/portal/login/page.module.css` — brutalist style matching the existing admin login. Use the project's design language: `#0a0a0a` black, `#f5f0eb` warm off-white, `#8a8580` muted text, sharp borders, no rounded corners, uppercase labels with wide letter-spacing.

```css
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f0eb;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border: 2px solid #0a0a0a;
}

.title {
  margin: 0;
  padding: 24px 28px 4px;
  font-size: 20px;
  font-weight: 700;
  color: #0a0a0a;
  letter-spacing: 0.02em;
}

.subtitle {
  margin: 0;
  padding: 0 28px 24px;
  font-size: 13px;
  color: #8a8580;
}

.form {
  padding: 0 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error {
  margin: 0;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #dc2626;
  color: #dc2626;
  font-size: 13px;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 9px;
  font-weight: 700;
  color: #8a8580;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.input {
  padding: 10px 12px;
  border: 2px solid #0a0a0a;
  background: #ffffff;
  font-size: 14px;
  color: #0a0a0a;
  outline: none;
  font-family: inherit;
}

.input:focus {
  border-color: #8a8580;
}

.button {
  padding: 12px;
  background: #0a0a0a;
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  font-family: inherit;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer {
  margin: 0;
  padding: 16px 28px;
  border-top: 1px solid #e8e4df;
  font-size: 13px;
  color: #8a8580;
  text-align: center;
}

.link {
  color: #0a0a0a;
  font-weight: 700;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 3: Create signup page**

Create `src/app/portal/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

export default function ClientSignupPage() {
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/portal/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone,
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.successBlock}>
            <h1 className={styles.title}>Account Submitted</h1>
            <p className={styles.successText}>
              Your account is pending approval. We&apos;ll email you at{" "}
              <strong>{form.email}</strong> once your account is activated.
            </p>
            <Link href="/portal/login" className={styles.backLink}>
              Back to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.subtitle}>
          Sign up for a trade account to book shoots on credit
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <p className={styles.error}>{error}</p>}

          <label className={styles.label}>
            Company Name
            <input
              className={styles.input}
              type="text"
              value={form.companyName}
              onChange={(e) => handleChange("companyName", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Contact Name
            <input
              className={styles.input}
              type="text"
              value={form.contactName}
              onChange={(e) => handleChange("contactName", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Phone
            <input
              className={styles.input}
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              value={form.password}
              onChange={(e) => handleChange("password", e.target.value)}
              required
              minLength={8}
            />
          </label>

          <label className={styles.label}>
            Confirm Password
            <input
              className={styles.input}
              type="password"
              value={form.confirmPassword}
              onChange={(e) => handleChange("confirmPassword", e.target.value)}
              required
            />
          </label>

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{" "}
          <Link href="/portal/login" className={styles.link}>
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create signup page styles**

Create `src/app/portal/signup/page.module.css` — same styles as login plus success state:

```css
.main {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f0eb;
  padding: 20px;
}

.card {
  width: 100%;
  max-width: 400px;
  background: #ffffff;
  border: 2px solid #0a0a0a;
}

.title {
  margin: 0;
  padding: 24px 28px 4px;
  font-size: 20px;
  font-weight: 700;
  color: #0a0a0a;
  letter-spacing: 0.02em;
}

.subtitle {
  margin: 0;
  padding: 0 28px 24px;
  font-size: 13px;
  color: #8a8580;
}

.form {
  padding: 0 28px 28px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error {
  margin: 0;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #dc2626;
  color: #dc2626;
  font-size: 13px;
}

.label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 9px;
  font-weight: 700;
  color: #8a8580;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.input {
  padding: 10px 12px;
  border: 2px solid #0a0a0a;
  background: #ffffff;
  font-size: 14px;
  color: #0a0a0a;
  outline: none;
  font-family: inherit;
}

.input:focus {
  border-color: #8a8580;
}

.button {
  padding: 12px;
  background: #0a0a0a;
  color: #ffffff;
  border: none;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  font-family: inherit;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.footer {
  margin: 0;
  padding: 16px 28px;
  border-top: 1px solid #e8e4df;
  font-size: 13px;
  color: #8a8580;
  text-align: center;
}

.link {
  color: #0a0a0a;
  font-weight: 700;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.successBlock {
  padding: 28px;
}

.successText {
  margin: 16px 0 24px;
  font-size: 14px;
  color: #0a0a0a;
  line-height: 1.6;
}

.backLink {
  display: inline-block;
  padding: 10px 20px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/portal/login/ src/app/portal/signup/
git commit -m "feat: add client portal login and signup pages"
```

---

## Task 7: Portal layout and navigation

**Files:**
- Create: `src/app/portal/layout.tsx`
- Create: `src/app/portal/components/PortalNav.tsx`
- Create: `src/app/portal/components/PortalNav.module.css`
- Create: `src/app/portal/page.tsx`

- [ ] **Step 1: Create portal nav component**

Create `src/app/portal/components/PortalNav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./PortalNav.module.css";

export default function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/portal/dashboard" className={styles.brand}>
          PropertyRoom
        </Link>
        <div className={styles.links}>
          <Link
            href="/portal/dashboard"
            className={`${styles.link} ${pathname === "/portal/dashboard" ? styles.active : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/portal/bookings"
            className={`${styles.link} ${pathname?.startsWith("/portal/bookings") ? styles.active : ""}`}
          >
            Bookings
          </Link>
          <Link
            href="/portal/invoices"
            className={`${styles.link} ${pathname === "/portal/invoices" ? styles.active : ""}`}
          >
            Invoices
          </Link>
          <Link
            href="/portal/account"
            className={`${styles.link} ${pathname?.startsWith("/portal/account") ? styles.active : ""}`}
          >
            Account
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

- [ ] **Step 2: Create portal nav styles**

Create `src/app/portal/components/PortalNav.module.css` — match existing `AdminNav.module.css` pattern:

```css
.nav {
  background: #0a0a0a;
  border-bottom: 2px solid #0a0a0a;
  position: sticky;
  top: 0;
  z-index: 100;
}

.inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.brand {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  text-decoration: none;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.links {
  display: flex;
  align-items: center;
  gap: 4px;
}

.link {
  padding: 8px 14px;
  font-size: 13px;
  color: #8a8580;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.15s;
}

.link:hover {
  color: #ffffff;
}

.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.logout {
  margin-left: 12px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #8a8580;
  color: #8a8580;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.logout:hover {
  border-color: #ffffff;
  color: #ffffff;
}
```

- [ ] **Step 3: Create portal layout**

Create `src/app/portal/layout.tsx`:

```tsx
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Create portal root redirect**

Create `src/app/portal/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function PortalPage() {
  redirect("/portal/dashboard");
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/portal/layout.tsx src/app/portal/page.tsx src/app/portal/components/
git commit -m "feat: add portal layout, navigation, and root redirect"
```

---

## Task 8: Portal dashboard API + page

**Files:**
- Create: `src/app/api/portal/dashboard/route.ts`
- Create: `src/app/portal/dashboard/page.tsx`
- Create: `src/app/portal/dashboard/page.module.css`

- [ ] **Step 1: Create dashboard API route**

Create `src/app/api/portal/dashboard/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices } from "@/lib/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = session.sub;

  // Get client details
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  // Running total: sum of completed bookings not yet invoiced
  const completedBookings = await db
    .select({
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${bookings.total}), 0)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "completed"))
    );

  // Pending shoots (upcoming)
  const pendingBookings = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(bookings)
    .where(
      and(eq(bookings.clientId, clientId), eq(bookings.status, "pending"))
    );

  // Total paid to date
  const paidInvoices = await db
    .select({
      total: sql<number>`coalesce(sum(${invoices.totalAmount}), 0)`,
    })
    .from(invoices)
    .where(
      and(eq(invoices.clientId, clientId), eq(invoices.status, "paid"))
    );

  return NextResponse.json({
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

- [ ] **Step 2: Create dashboard page**

Create `src/app/portal/dashboard/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface DashboardData {
  client: {
    id: string;
    companyName: string;
    contactName: string;
    email: string;
    status: string;
    hasMandateSetup: boolean;
    bookingsPaused: boolean;
  };
  runningTotal: number;
  completedShootCount: number;
  pendingShootCount: number;
  totalPaidToDate: number;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading || !data) {
    return (
      <>
        <PortalNav />
        <main className={styles.main}>
          <p className={styles.loading}>Loading...</p>
        </main>
      </>
    );
  }

  const { client } = data;

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            Welcome, {client.companyName}
          </h1>

          {/* Status banners */}
          {client.status === "pending_approval" && (
            <div className={styles.bannerWarning}>
              Your account is pending approval. You&apos;ll be able to book
              shoots once your account is activated.
            </div>
          )}

          {client.status === "suspended" && (
            <div className={styles.bannerError}>
              Your account has been suspended. Please contact us for more
              information.
            </div>
          )}

          {client.status === "active" && !client.hasMandateSetup && (
            <div className={styles.bannerAction}>
              <span>Set up your payment method to start booking shoots.</span>
              <Link
                href="/portal/account/setup-mandate"
                className={styles.bannerBtn}
              >
                Set Up Payment
              </Link>
            </div>
          )}

          {client.bookingsPaused && (
            <div className={styles.bannerError}>
              Your booking ability is paused due to a failed payment. Please
              contact us to resolve this.
            </div>
          )}

          {/* Stats grid */}
          {client.status === "active" && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Running Total</span>
                <span className={styles.statValue}>
                  {pence(data.runningTotal)}
                </span>
                <span className={styles.statSub}>
                  {data.completedShootCount} completed shoot
                  {data.completedShootCount !== 1 ? "s" : ""} awaiting invoice
                </span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Upcoming Shoots</span>
                <span className={styles.statValue}>
                  {data.pendingShootCount}
                </span>
                <span className={styles.statSub}>pending</span>
              </div>

              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Paid</span>
                <span className={styles.statValue}>
                  {pence(data.totalPaidToDate)}
                </span>
                <span className={styles.statSub}>to date</span>
              </div>
            </div>
          )}

          {/* Quick actions */}
          {client.status === "active" && client.hasMandateSetup && !client.bookingsPaused && (
            <div className={styles.actions}>
              <Link href="/portal/bookings/new" className={styles.primaryBtn}>
                Book a Shoot
              </Link>
              <Link href="/portal/bookings" className={styles.secondaryBtn}>
                View All Bookings
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create dashboard styles**

Create `src/app/portal/dashboard/page.module.css`:

```css
.main {
  min-height: 100vh;
  background: #f5f0eb;
  padding: 40px 20px;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.loading {
  text-align: center;
  color: #8a8580;
  font-size: 14px;
}

.title {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 700;
  color: #0a0a0a;
  letter-spacing: 0.02em;
}

.bannerWarning {
  padding: 14px 18px;
  background: #fefce8;
  border: 2px solid #ca8a04;
  color: #854d0e;
  font-size: 14px;
  margin-bottom: 20px;
}

.bannerError {
  padding: 14px 18px;
  background: #fef2f2;
  border: 2px solid #dc2626;
  color: #dc2626;
  font-size: 14px;
  margin-bottom: 20px;
}

.bannerAction {
  padding: 14px 18px;
  background: #ffffff;
  border: 2px solid #0a0a0a;
  font-size: 14px;
  color: #0a0a0a;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.bannerBtn {
  padding: 8px 18px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
  white-space: nowrap;
}

.statsGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.statCard {
  background: #ffffff;
  border: 2px solid #0a0a0a;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.statLabel {
  font-size: 9px;
  font-weight: 700;
  color: #8a8580;
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

.statValue {
  font-size: 28px;
  font-weight: 700;
  color: #0a0a0a;
  font-variant-numeric: tabular-nums;
}

.statSub {
  font-size: 12px;
  color: #8a8580;
}

.actions {
  display: flex;
  gap: 12px;
}

.primaryBtn {
  padding: 12px 24px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}

.secondaryBtn {
  padding: 12px 24px;
  background: #ffffff;
  border: 2px solid #0a0a0a;
  color: #0a0a0a;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}

@media (max-width: 640px) {
  .statsGrid {
    grid-template-columns: 1fr;
  }

  .bannerAction {
    flex-direction: column;
    align-items: flex-start;
  }

  .actions {
    flex-direction: column;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/dashboard/ src/app/portal/dashboard/
git commit -m "feat: add portal dashboard with running total and stats"
```

---

## Task 9: Portal bookings API + list page

**Files:**
- Create: `src/app/api/portal/bookings/route.ts`
- Create: `src/app/portal/bookings/page.tsx`
- Create: `src/app/portal/bookings/page.module.css`

- [ ] **Step 1: Create portal bookings API**

Create `src/app/api/portal/bookings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, clients } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { calcWorkHours } from "@/lib/scheduling";
import { calcPropertyTotal, type PropertyServices } from "@/lib/pricing";

export async function GET() {
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

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = session.sub;

  // Verify client is active, has mandate, and not paused
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  if (client.status !== "active") {
    return NextResponse.json(
      { error: "Account is not active" },
      { status: 403 }
    );
  }

  if (!client.gocardlessMandateId) {
    return NextResponse.json(
      { error: "Payment method not set up" },
      { status: 403 }
    );
  }

  if (client.bookingsPaused) {
    return NextResponse.json(
      { error: "Bookings are paused due to a failed payment" },
      { status: 403 }
    );
  }

  try {
    const { properties } = await request.json();

    if (!properties?.length) {
      return NextResponse.json(
        { error: "No properties provided" },
        { status: 400 }
      );
    }

    const createdIds: string[] = [];

    for (const p of properties) {
      const services: PropertyServices = {
        bedrooms: p.bedrooms,
        photography: p.photography || false,
        photoCount: p.photoCount || 20,
        dronePhotography: p.dronePhotography || false,
        dronePhotoCount: p.dronePhotoCount || 8,
        standardVideo: p.standardVideo || false,
        standardVideoDrone: p.standardVideoDrone || false,
        agentPresentedVideo: p.agentPresentedVideo || false,
        agentPresentedVideoDrone: p.agentPresentedVideoDrone || false,
        socialMediaVideo: p.socialMediaVideo || false,
        socialMediaPresentedVideo: p.socialMediaPresentedVideo || false,
        standardFloorPlan: p.standardFloorPlan || false,
        premiumFloorPlan: p.premiumFloorPlan || false,
        floorPlan3D: p.floorPlan3D || false,
      };

      const subtotal = Math.round(calcPropertyTotal(services) * 100);
      const total = subtotal; // No discount for account clients — they're on credit

      const workHours = calcWorkHours({
        ...services,
        bedrooms: p.bedrooms,
      });

      let startTime: string | null = p.timeSlot || null;
      let endTime: string | null = null;
      if (startTime) {
        const [h, m] = startTime.split(":").map(Number);
        const endMins = h * 60 + m + Math.round(workHours * 60);
        endTime = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
      }

      const id = crypto.randomUUID();
      createdIds.push(id);

      await db.insert(bookings).values({
        id,
        address: p.address,
        postcode: p.postcode || null,
        bedrooms: p.bedrooms,
        preferredDate: p.preferredDate,
        startTime,
        endTime,
        notes: p.notes || null,
        agentName: client.contactName,
        agentCompany: client.companyName,
        agentEmail: client.email,
        agentPhone: client.phone,
        services: JSON.stringify(services),
        workHours,
        subtotal,
        discountCode: null,
        discountAmount: 0,
        total,
        stripeSession: null,
        status: "pending",
        clientId,
      });
    }

    // Notify Harrison about the new booking
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    const addresses = properties.map((p: { address: string }) => p.address).join(", ");

    resend.emails.send({
      from: "Harrison <harrison@thepropertyroom.co>",
      to: "harrison@thepropertyroom.co",
      subject: `New Booking from ${client.companyName}: ${addresses}`,
      html: `
        <h2>New Account Booking</h2>
        <p><strong>Client:</strong> ${client.companyName}</p>
        <p><strong>Contact:</strong> ${client.contactName} (${client.email})</p>
        <p><strong>Properties:</strong> ${properties.length}</p>
        <ul>${properties.map((p: { address: string; preferredDate: string }) => `<li>${p.address} — ${p.preferredDate}</li>`).join("")}</ul>
      `,
    }).catch((err: unknown) => console.error("Failed to send booking notification:", err));

    return NextResponse.json({ success: true, bookingIds: createdIds });
  } catch (err) {
    console.error("Portal booking error:", err);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create portal bookings list page**

Create `src/app/portal/bookings/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface Booking {
  id: string;
  address: string;
  postcode: string | null;
  bedrooms: number;
  preferredDate: string;
  startTime: string | null;
  endTime: string | null;
  services: string;
  total: number;
  status: string;
}

type StatusFilter =
  | "all"
  | "pending"
  | "completed"
  | "invoiced"
  | "paid"
  | "cancelled";

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0
    ? `${hour}${period}`
    : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function parseServiceNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    const labels: string[] = [];
    if (parsed.photography) labels.push(`Photography (${parsed.photoCount ?? 20} photos)`);
    if (parsed.dronePhotography) labels.push(`Drone Photography`);
    if (parsed.standardVideo) labels.push("Standard Video");
    if (parsed.agentPresentedVideo) labels.push("Agent Presented Video");
    if (parsed.socialMediaVideo) labels.push("Social Media Video");
    if (parsed.socialMediaPresentedVideo) labels.push("Social Media Video (Presented)");
    if (parsed.standardFloorPlan) labels.push("Standard Floor Plan");
    if (parsed.premiumFloorPlan) labels.push("Premium Floor Plan");
    if (parsed.floorPlan3D) labels.push("3D Floor Plan");
    return labels.length > 0 ? labels : ["—"];
  } catch {
    return ["—"];
  }
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
  payment_failed: "Payment Failed",
};

export default function PortalBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetch("/api/portal/bookings")
      .then((r) => r.json())
      .then((d) => {
        setBookings(d);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    return bookings.filter((b) => b.status === filter);
  }, [bookings, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length };
    for (const b of bookings) {
      c[b.status] = (c[b.status] || 0) + 1;
    }
    return c;
  }, [bookings]);

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <h1 className={styles.title}>Bookings</h1>
            <Link href="/portal/bookings/new" className={styles.newBtn}>
              Book a Shoot
            </Link>
          </div>

          <div className={styles.tabs}>
            {(
              ["all", "pending", "completed", "invoiced", "paid", "cancelled"] as StatusFilter[]
            ).map((s) => (
              <button
                key={s}
                className={`${styles.tab} ${filter === s ? styles.tabActive : ""}`}
                onClick={() => setFilter(s)}
              >
                {s === "all" ? "All" : STATUS_LABELS[s] || s}
                {counts[s] !== undefined && (
                  <span className={styles.tabCount}>{counts[s]}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>No bookings found</p>
          ) : (
            <div className={styles.list}>
              {filtered.map((b) => {
                const services = parseServiceNames(b.services);
                const timeStr =
                  b.startTime && b.endTime
                    ? `${formatTime(b.startTime)} – ${formatTime(b.endTime)}`
                    : null;

                return (
                  <div key={b.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div>
                        <p className={styles.cardAddress}>
                          {b.address}
                          {b.postcode ? `, ${b.postcode}` : ""}
                        </p>
                        <p className={styles.cardDate}>
                          {formatDate(b.preferredDate)}
                          {timeStr ? ` · ${timeStr}` : ""}
                        </p>
                      </div>
                      <div className={styles.cardRight}>
                        <span className={styles.cardTotal}>
                          {pence(b.total)}
                        </span>
                        <span
                          className={`${styles.badge} ${styles[`badge_${b.status}`] || ""}`}
                        >
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cardServices}>
                      {services.join(" · ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Create portal bookings styles**

Create `src/app/portal/bookings/page.module.css`:

```css
.main {
  min-height: 100vh;
  background: #f5f0eb;
  padding: 40px 20px;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #0a0a0a;
}

.newBtn {
  padding: 10px 20px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.tab {
  padding: 8px 14px;
  background: #ffffff;
  border: 2px solid #e8e4df;
  font-size: 12px;
  font-weight: 600;
  color: #8a8580;
  cursor: pointer;
  font-family: inherit;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tabActive {
  border-color: #0a0a0a;
  color: #0a0a0a;
}

.tabCount {
  font-size: 11px;
  background: #f5f0eb;
  padding: 1px 6px;
  font-variant-numeric: tabular-nums;
}

.empty {
  text-align: center;
  color: #8a8580;
  font-size: 14px;
  padding: 40px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card {
  background: #ffffff;
  border: 2px solid #0a0a0a;
  padding: 16px 20px;
}

.cardTop {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.cardAddress {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0a0a0a;
}

.cardDate {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a8580;
}

.cardRight {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.cardTotal {
  font-size: 16px;
  font-weight: 700;
  color: #0a0a0a;
  font-variant-numeric: tabular-nums;
}

.badge {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
}

.badge_pending {
  color: #ca8a04;
  border-color: #ca8a04;
  background: #fefce8;
}

.badge_completed {
  color: #2563eb;
  border-color: #2563eb;
  background: #eff6ff;
}

.badge_invoiced {
  color: #7c3aed;
  border-color: #7c3aed;
  background: #f5f3ff;
}

.badge_paid {
  color: #16a34a;
  border-color: #16a34a;
  background: #f0fdf4;
}

.badge_cancelled {
  color: #dc2626;
  border-color: #dc2626;
  background: #fef2f2;
}

.badge_payment_failed {
  color: #dc2626;
  border-color: #dc2626;
  background: #fef2f2;
}

.cardServices {
  margin-top: 10px;
  font-size: 12px;
  color: #8a8580;
  border-top: 1px solid #e8e4df;
  padding-top: 10px;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portal/bookings/ src/app/portal/bookings/page.tsx src/app/portal/bookings/page.module.css
git commit -m "feat: add portal bookings API and list page"
```

---

## Task 10: Portal new booking page

**Files:**
- Create: `src/app/portal/bookings/new/page.tsx`
- Create: `src/app/portal/bookings/new/page.module.css`

- [ ] **Step 1: Create new booking page for portal clients**

This page reuses the same booking flow as the public `/book` page but without agent details or payment. The implementation should follow the same component structure as the existing `BookingSection` — with `PropertyBlock` and service selection — but adapted for the portal context. Since this is the same flow minus payment, read the existing `src/components/BookingSection.tsx`, `src/components/PropertyBlock.tsx`, and `src/components/DatePicker.tsx` to understand the full form structure, then create the portal version at `src/app/portal/bookings/new/page.tsx`.

Key differences from the public booking form:
- No `AgentDetails` section — pulled from client account
- No `Basket` / Stripe checkout — submits directly to `POST /api/portal/bookings`
- Each property becomes a separate booking record
- Success redirects to `/portal/bookings`
- Uses `PortalNav` instead of public nav

The page should import and reuse `PropertyBlock` and `DatePicker` components where possible rather than duplicating them.

- [ ] **Step 2: Create styles for new booking page**

Create `src/app/portal/bookings/new/page.module.css` matching the existing booking page styles adapted for the portal context.

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/bookings/new/
git commit -m "feat: add portal new booking page"
```

---

## Task 11: Portal invoices API + page

**Files:**
- Create: `src/app/api/portal/invoices/route.ts`
- Create: `src/app/api/portal/invoices/[id]/pdf/route.ts`
- Create: `src/app/portal/invoices/page.tsx`
- Create: `src/app/portal/invoices/page.module.css`

- [ ] **Step 1: Create portal invoices list API**

Create `src/app/api/portal/invoices/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, session.sub))
    .orderBy(invoices.createdAt);

  // For each invoice, get its line items with booking details
  const result = await Promise.all(
    invoiceRows.map(async (inv) => {
      const items = await db
        .select({
          id: invoiceItems.id,
          bookingId: invoiceItems.bookingId,
          amount: invoiceItems.amount,
          address: bookings.address,
          postcode: bookings.postcode,
          preferredDate: bookings.preferredDate,
          services: bookings.services,
        })
        .from(invoiceItems)
        .leftJoin(bookings, eq(invoiceItems.bookingId, bookings.id))
        .where(eq(invoiceItems.invoiceId, inv.id));

      return {
        ...inv,
        items,
      };
    })
  );

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create invoice PDF download route**

Create `src/app/api/portal/invoices/[id]/pdf/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { readFile } from "fs/promises";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.clientId, session.sub)))
    .limit(1);

  if (rows.length === 0 || !rows[0].pdfPath) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdfBuffer = await readFile(rows[0].pdfPath);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: Create portal invoices page**

Create `src/app/portal/invoices/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import PortalNav from "../components/PortalNav";
import styles from "./page.module.css";

interface InvoiceItem {
  id: string;
  bookingId: string;
  amount: number;
  address: string | null;
  postcode: string | null;
  preferredDate: string | null;
  services: string | null;
}

interface Invoice {
  id: string;
  totalAmount: number;
  status: string;
  chargedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  items: InvoiceItem[];
}

function pence(amount: number): string {
  return `£${(amount / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function PortalInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/portal/invoices")
      .then((r) => r.json())
      .then((d) => {
        setInvoices(d);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>Invoices</h1>

          {loading ? (
            <p className={styles.empty}>Loading...</p>
          ) : invoices.length === 0 ? (
            <p className={styles.empty}>No invoices yet</p>
          ) : (
            <div className={styles.list}>
              {invoices.map((inv) => (
                <div key={inv.id} className={styles.card}>
                  <button
                    className={styles.cardHeader}
                    onClick={() =>
                      setExpandedId(expandedId === inv.id ? null : inv.id)
                    }
                  >
                    <div>
                      <p className={styles.cardDate}>
                        {inv.chargedAt ? formatDate(inv.chargedAt) : "—"}
                      </p>
                      <p className={styles.cardShoots}>
                        {inv.items.length} shoot
                        {inv.items.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className={styles.cardRight}>
                      <span className={styles.cardTotal}>
                        {pence(inv.totalAmount)}
                      </span>
                      <span
                        className={`${styles.badge} ${styles[`badge_${inv.status}`] || ""}`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </button>

                  {expandedId === inv.id && (
                    <div className={styles.cardBody}>
                      {inv.failureReason && (
                        <p className={styles.failureReason}>
                          Payment failed: {inv.failureReason}
                        </p>
                      )}
                      <table className={styles.itemsTable}>
                        <thead>
                          <tr>
                            <th>Address</th>
                            <th>Date</th>
                            <th>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.items.map((item) => (
                            <tr key={item.id}>
                              <td>
                                {item.address}
                                {item.postcode ? `, ${item.postcode}` : ""}
                              </td>
                              <td>
                                {item.preferredDate
                                  ? formatDate(item.preferredDate)
                                  : "—"}
                              </td>
                              <td>{pence(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <a
                        href={`/api/portal/invoices/${inv.id}/pdf`}
                        className={styles.downloadBtn}
                      >
                        Download PDF
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 4: Create invoices page styles**

Create `src/app/portal/invoices/page.module.css`:

```css
.main {
  min-height: 100vh;
  background: #f5f0eb;
  padding: 40px 20px;
}

.container {
  max-width: 900px;
  margin: 0 auto;
}

.title {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 700;
  color: #0a0a0a;
}

.empty {
  text-align: center;
  color: #8a8580;
  font-size: 14px;
  padding: 40px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card {
  background: #ffffff;
  border: 2px solid #0a0a0a;
}

.cardHeader {
  width: 100%;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}

.cardDate {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0a0a0a;
}

.cardShoots {
  margin: 4px 0 0;
  font-size: 12px;
  color: #8a8580;
}

.cardRight {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cardTotal {
  font-size: 16px;
  font-weight: 700;
  color: #0a0a0a;
  font-variant-numeric: tabular-nums;
}

.badge {
  padding: 2px 8px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border: 1px solid;
}

.badge_pending {
  color: #ca8a04;
  border-color: #ca8a04;
  background: #fefce8;
}

.badge_paid {
  color: #16a34a;
  border-color: #16a34a;
  background: #f0fdf4;
}

.badge_failed {
  color: #dc2626;
  border-color: #dc2626;
  background: #fef2f2;
}

.cardBody {
  padding: 0 20px 20px;
  border-top: 1px solid #e8e4df;
}

.failureReason {
  margin: 12px 0;
  padding: 10px 12px;
  background: #fef2f2;
  border: 1px solid #dc2626;
  color: #dc2626;
  font-size: 13px;
}

.itemsTable {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
}

.itemsTable th {
  text-align: left;
  padding: 6px 0;
  font-size: 9px;
  font-weight: 700;
  color: #8a8580;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  border-bottom: 1px solid #e8e4df;
}

.itemsTable th:last-child {
  text-align: right;
}

.itemsTable td {
  padding: 8px 0;
  font-size: 13px;
  color: #0a0a0a;
  border-bottom: 1px solid #e8e4df;
}

.itemsTable td:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.downloadBtn {
  display: inline-block;
  margin-top: 12px;
  padding: 8px 16px;
  background: #0a0a0a;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-decoration: none;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portal/invoices/ src/app/portal/invoices/
git commit -m "feat: add portal invoices API and page with PDF download"
```

---

## Task 12: Portal account page + mandate setup

**Files:**
- Create: `src/app/api/portal/account/route.ts`
- Create: `src/app/api/portal/account/change-password/route.ts`
- Create: `src/app/api/portal/account/setup-mandate/route.ts`
- Create: `src/app/api/portal/account/mandate-status/route.ts`
- Create: `src/app/portal/account/page.tsx`
- Create: `src/app/portal/account/page.module.css`
- Create: `src/app/portal/account/setup-mandate/page.tsx`
- Create: `src/app/portal/account/setup-mandate/page.module.css`

- [ ] **Step 1: Create account API routes**

Create `src/app/api/portal/account/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: clients.id,
      companyName: clients.companyName,
      contactName: clients.contactName,
      email: clients.email,
      phone: clients.phone,
      status: clients.status,
      gocardlessMandateId: clients.gocardlessMandateId,
      bookingsPaused: clients.bookingsPaused,
      createdAt: clients.createdAt,
    })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function PATCH(request: Request) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyName, contactName, phone } = await request.json();

  const updates: Record<string, string> = {};
  if (companyName) updates.companyName = companyName;
  if (contactName) updates.contactName = contactName;
  if (phone) updates.phone = phone;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db
    .update(clients)
    .set(updates)
    .where(eq(clients.id, session.sub));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create change password API**

Create `src/app/api/portal/account/change-password/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession, verifyPassword, hashPassword } from "@/lib/client-auth";

export async function POST(request: Request) {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Current and new passwords are required" },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const rows = await db
    .select({ passwordHash: clients.passwordHash })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, rows[0].passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect" },
      { status: 401 }
    );
  }

  const newHash = await hashPassword(newPassword);

  await db
    .update(clients)
    .set({ passwordHash: newHash })
    .where(eq(clients.id, session.sub));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create mandate setup API**

Create `src/app/api/portal/account/setup-mandate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { createBillingRequestFlow } from "@/lib/gocardless";

export async function POST() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = rows[0];

  if (client.status !== "active") {
    return NextResponse.json(
      { error: "Account must be active to set up payment" },
      { status: 403 }
    );
  }

  try {
    const { authorisationUrl } = await createBillingRequestFlow(
      client.email,
      client.contactName,
      client.companyName
    );

    return NextResponse.json({ authorisationUrl });
  } catch (err) {
    console.error("GoCardless mandate setup error:", err);
    return NextResponse.json(
      { error: "Failed to set up payment method" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create mandate status API**

Create `src/app/api/portal/account/mandate-status/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";

export async function GET() {
  const session = await getClientSession();
  if (!session?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      gocardlessMandateId: clients.gocardlessMandateId,
      gocardlessCustomerId: clients.gocardlessCustomerId,
    })
    .from(clients)
    .where(eq(clients.id, session.sub))
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    hasMandateSetup: !!rows[0].gocardlessMandateId,
  });
}
```

- [ ] **Step 5: Create account settings page and mandate setup page**

Create `src/app/portal/account/page.tsx` and `src/app/portal/account/setup-mandate/page.tsx` with their respective styles. The account page shows company details (editable), change password form, and mandate status. The mandate setup page uses the GoCardless drop-in component via the authorisation URL returned by the API — it loads the URL in an iframe or redirects.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/portal/account/ src/app/portal/account/
git commit -m "feat: add portal account settings and GoCardless mandate setup"
```

---

## Task 13: Admin clients API routes

**Files:**
- Create: `src/app/api/admin/clients/route.ts`
- Create: `src/app/api/admin/clients/[id]/route.ts`
- Create: `src/app/api/admin/clients/[id]/charge/route.ts`
- Create: `src/app/api/admin/invoices/[id]/retry/route.ts`

- [ ] **Step 1: Create admin clients list API**

Create `src/app/api/admin/clients/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings } from "@/lib/schema";
import { eq, like, or, sql, and } from "drizzle-orm";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions = [];
  if (status) conditions.push(eq(clients.status, status));
  if (search) {
    conditions.push(
      or(
        like(clients.companyName, `%${search}%`),
        like(clients.email, `%${search}%`),
        like(clients.contactName, `%${search}%`)
      )!
    );
  }

  const clientRows = await db
    .select()
    .from(clients)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(clients.createdAt);

  // Get running balance for each client
  const result = await Promise.all(
    clientRows.map(async (c) => {
      const balance = await db
        .select({
          total: sql<number>`coalesce(sum(${bookings.total}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(bookings)
        .where(
          and(eq(bookings.clientId, c.id), eq(bookings.status, "completed"))
        );

      return {
        ...c,
        runningBalance: balance[0]?.total ?? 0,
        completedBookings: balance[0]?.count ?? 0,
      };
    })
  );

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create admin client detail + status update API**

Create `src/app/api/admin/clients/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices, invoiceItems } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = rows[0];

  // Completed bookings (running balance)
  const completedBookings = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.clientId, id), eq(bookings.status, "completed")));

  const runningBalance = completedBookings.reduce((s, b) => s + b.total, 0);

  // All bookings
  const allBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.clientId, id))
    .orderBy(bookings.preferredDate);

  // All invoices
  const clientInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.clientId, id))
    .orderBy(invoices.createdAt);

  return NextResponse.json({
    client,
    completedBookings,
    runningBalance,
    allBookings,
    invoices: clientInvoices,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const rows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (rows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = rows[0];
  const updates: Record<string, unknown> = {};

  if (body.status) {
    const validStatuses = ["pending_approval", "active", "suspended", "deactivated"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;

    // Send email notifications on status change
    if (body.status === "active" && client.status === "pending_approval") {
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Your Account Has Been Approved — The Property Room",
        html: `
          <h2>Account Approved</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your account for <strong>${client.companyName}</strong> has been approved.</p>
          <p>Log in to set up your payment method and start booking shoots.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/login">Log in to your portal</a></p>
        `,
      }).catch((err) => console.error("Failed to send approval email:", err));
    }

    if (body.status === "suspended" || body.status === "deactivated") {
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: `Your Account Has Been ${body.status === "suspended" ? "Suspended" : "Deactivated"} — The Property Room`,
        html: `
          <h2>Account ${body.status === "suspended" ? "Suspended" : "Deactivated"}</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your account for <strong>${client.companyName}</strong> has been ${body.status}.</p>
          <p>Please contact us if you have any questions.</p>
        `,
      }).catch((err) => console.error("Failed to send status email:", err));
    }
  }

  if (body.unpauseBookings === true) {
    updates.bookingsPaused = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(clients).set(updates).where(eq(clients.id, id));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create charge client API**

Create `src/app/api/admin/clients/[id]/charge/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings, invoices, invoiceItems } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { createPayment } from "@/lib/gocardless";
import { generateAccountInvoicePdf } from "@/lib/account-invoice-pdf";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { bookingIds } = await request.json();

  if (!bookingIds?.length) {
    return NextResponse.json(
      { error: "No bookings selected" },
      { status: 400 }
    );
  }

  // Get client
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  if (!client.gocardlessMandateId) {
    return NextResponse.json(
      { error: "Client has no active payment mandate" },
      { status: 400 }
    );
  }

  // Get the selected completed bookings
  const selectedBookings = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.clientId, id),
        eq(bookings.status, "completed"),
        inArray(bookings.id, bookingIds)
      )
    );

  if (selectedBookings.length === 0) {
    return NextResponse.json(
      { error: "No valid completed bookings found" },
      { status: 400 }
    );
  }

  const totalAmount = selectedBookings.reduce((s, b) => s + b.total, 0);
  const invoiceId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    // Create invoice record
    await db.insert(invoices).values({
      id: invoiceId,
      clientId: id,
      totalAmount,
      status: "pending",
      chargedAt: now,
    });

    // Create invoice items
    for (const b of selectedBookings) {
      await db.insert(invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId,
        bookingId: b.id,
        amount: b.total,
      });
    }

    // Generate PDF
    const pdfBuffer = await generateAccountInvoicePdf({
      invoiceId,
      client,
      bookings: selectedBookings,
      totalAmount,
      chargedAt: now,
    });

    // Store PDF (write to temp path for now)
    const { writeFile, mkdir } = await import("fs/promises");
    const { join } = await import("path");
    const pdfDir = join(process.cwd(), "invoices");
    await mkdir(pdfDir, { recursive: true });
    const pdfPath = join(pdfDir, `${invoiceId}.pdf`);
    await writeFile(pdfPath, pdfBuffer);

    // Update invoice with PDF path
    await db
      .update(invoices)
      .set({ pdfPath })
      .where(eq(invoices.id, invoiceId));

    // Create GoCardless payment
    const paymentId = await createPayment(
      client.gocardlessMandateId,
      totalAmount,
      `The Property Room — ${selectedBookings.length} shoot${selectedBookings.length !== 1 ? "s" : ""}`,
      invoiceId
    );

    // Update invoice with payment ID
    await db
      .update(invoices)
      .set({ gocardlessPaymentId: paymentId })
      .where(eq(invoices.id, invoiceId));

    // Update bookings to invoiced
    await db
      .update(bookings)
      .set({ status: "invoiced" })
      .where(inArray(bookings.id, bookingIds));

    // Send invoice email to client
    resend.emails.send({
      from: "Harrison <harrison@thepropertyroom.co>",
      to: client.email,
      subject: `Invoice for £${(totalAmount / 100).toFixed(2)} — The Property Room`,
      html: `
        <h2>Invoice</h2>
        <p>Hi ${client.contactName},</p>
        <p>An invoice for <strong>£${(totalAmount / 100).toFixed(2)}</strong> has been raised for ${selectedBookings.length} shoot${selectedBookings.length !== 1 ? "s" : ""}.</p>
        <p>Payment will be collected via Direct Debit within a few working days.</p>
        <p>Your invoice is attached as a PDF.</p>
      `,
      attachments: [
        {
          filename: `invoice-${invoiceId.slice(0, 8)}.pdf`,
          content: pdfBuffer,
        },
      ],
    }).catch((err) => console.error("Failed to send invoice email:", err));

    return NextResponse.json({
      success: true,
      invoiceId,
      totalAmount,
      bookingsCharged: selectedBookings.length,
    });
  } catch (err) {
    console.error("Charge error:", err);
    return NextResponse.json(
      { error: "Failed to process charge" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create retry payment API**

Create `src/app/api/admin/invoices/[id]/retry/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings, clients } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { createPayment, getMandate } from "@/lib/gocardless";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, id))
    .limit(1);

  if (invoiceRows.length === 0) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const invoice = invoiceRows[0];

  if (invoice.status !== "failed") {
    return NextResponse.json(
      { error: "Can only retry failed invoices" },
      { status: 400 }
    );
  }

  // Get client
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, invoice.clientId))
    .limit(1);

  if (clientRows.length === 0) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const client = clientRows[0];

  if (!client.gocardlessMandateId) {
    return NextResponse.json(
      { error: "Client has no active mandate. They need to set up a new payment method." },
      { status: 400 }
    );
  }

  // Check mandate is still active
  try {
    const mandate = await getMandate(client.gocardlessMandateId);
    if (mandate.status !== "active") {
      return NextResponse.json(
        { error: "Client's mandate is no longer active. They need to set up a new payment method." },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Could not verify mandate status" },
      { status: 500 }
    );
  }

  try {
    // Get booking IDs for this invoice
    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, id));

    const bookingIds = items.map((i) => i.bookingId);

    // Create new GoCardless payment
    const paymentId = await createPayment(
      client.gocardlessMandateId,
      invoice.totalAmount,
      `The Property Room — retry`,
      invoice.id
    );

    // Reset invoice status
    await db
      .update(invoices)
      .set({
        status: "pending",
        gocardlessPaymentId: paymentId,
        failureReason: null,
      })
      .where(eq(invoices.id, id));

    // Reset bookings back to invoiced
    if (bookingIds.length > 0) {
      await db
        .update(bookings)
        .set({ status: "invoiced" })
        .where(inArray(bookings.id, bookingIds));
    }

    return NextResponse.json({ success: true, paymentId });
  } catch (err) {
    console.error("Retry payment error:", err);
    return NextResponse.json(
      { error: "Failed to retry payment" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/clients/ src/app/api/admin/invoices/
git commit -m "feat: add admin client management and charge/retry APIs"
```

---

## Task 14: Account invoice PDF generation

**Files:**
- Create: `src/lib/account-invoice-pdf.ts`

- [ ] **Step 1: Create cumulative multi-shoot invoice PDF generator**

Create `src/lib/account-invoice-pdf.ts` following the same pattern as the existing `src/lib/invoice-pdf.ts` (using `pdf-lib`, same brutalist design language, same fonts). The key differences:

- Invoice number format: `TPR-ACC-YYYYMMDD-XXXX` (using first 4 chars of invoiceId)
- "Bill To" shows client company name, contact name, email, phone
- Lists multiple shoots instead of a single booking — each shoot shows: address, date, services, amount
- Total bar says "TOTAL DUE" instead of "TOTAL PAID" (since it's a Direct Debit collection)
- Footer says "Payment will be collected via Direct Debit."

The function signature:

```typescript
interface AccountInvoiceData {
  invoiceId: string;
  client: {
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
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
  chargedAt: string; // ISO date
}

export async function generateAccountInvoicePdf(
  data: AccountInvoiceData
): Promise<Buffer>
```

Follow the existing `invoice-pdf.ts` code structure closely — same margins (ml=50, mr=50), same color scheme (`rgb(0.04, 0.04, 0.04)` for black, `rgb(0.54, 0.52, 0.5)` for muted), same logo loading, same font embedding (Helvetica + HelveticaBold). Add page break logic if the shoots list gets long enough to exceed A4 height.

- [ ] **Step 2: Commit**

```bash
git add src/lib/account-invoice-pdf.ts
git commit -m "feat: add cumulative account invoice PDF generator"
```

---

## Task 15: GoCardless webhook handler

**Files:**
- Create: `src/app/api/webhook/gocardless/route.ts`

- [ ] **Step 1: Create GoCardless webhook endpoint**

Create `src/app/api/webhook/gocardless/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceItems, bookings, clients } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
import { verifyWebhookSignature } from "@/lib/gocardless";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const HARRISON_EMAIL = "harrison@thepropertyroom.co";

interface GoCardlessEvent {
  id: string;
  resource_type: string;
  action: string;
  links: Record<string, string>;
  details: {
    cause: string;
    description: string;
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("webhook-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payload = JSON.parse(body);
  const events: GoCardlessEvent[] = payload.events || [];

  for (const event of events) {
    try {
      if (event.resource_type === "payments") {
        await handlePaymentEvent(event);
      } else if (event.resource_type === "mandates") {
        await handleMandateEvent(event);
      }
    } catch (err) {
      console.error(`Error processing GoCardless event ${event.id}:`, err);
    }
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentEvent(event: GoCardlessEvent) {
  const paymentId = event.links.payment;

  // Find invoice by GoCardless payment ID
  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.gocardlessPaymentId, paymentId))
    .limit(1);

  if (invoiceRows.length === 0) return;

  const invoice = invoiceRows[0];

  if (event.action === "paid_out") {
    // Payment successful
    const now = new Date().toISOString();

    await db
      .update(invoices)
      .set({ status: "paid", paidAt: now })
      .where(eq(invoices.id, invoice.id));

    // Update linked bookings to paid
    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    const bookingIds = items.map((i) => i.bookingId);
    if (bookingIds.length > 0) {
      await db
        .update(bookings)
        .set({ status: "paid" })
        .where(inArray(bookings.id, bookingIds));
    }

    // Unpause bookings if paused
    await db
      .update(clients)
      .set({ bookingsPaused: 0 })
      .where(eq(clients.id, invoice.clientId));

    // Notify client
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: `Payment of £${(invoice.totalAmount / 100).toFixed(2)} Received — The Property Room`,
        html: `
          <h2>Payment Received</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your payment of <strong>£${(invoice.totalAmount / 100).toFixed(2)}</strong> has been received. Thank you.</p>
        `,
      }).catch((err) => console.error("Failed to send payment confirmation:", err));
    }
  } else if (event.action === "failed") {
    // Payment failed
    const reason = event.details?.description || event.details?.cause || "Unknown reason";

    await db
      .update(invoices)
      .set({ status: "failed", failureReason: reason })
      .where(eq(invoices.id, invoice.id));

    // Update linked bookings to payment_failed
    const items = await db
      .select({ bookingId: invoiceItems.bookingId })
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    const bookingIds = items.map((i) => i.bookingId);
    if (bookingIds.length > 0) {
      await db
        .update(bookings)
        .set({ status: "payment_failed" })
        .where(inArray(bookings.id, bookingIds));
    }

    // Pause client bookings
    await db
      .update(clients)
      .set({ bookingsPaused: 1 })
      .where(eq(clients.id, invoice.clientId));

    // Notify both parties
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.id, invoice.clientId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];

      // Notify client
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Payment Failed — The Property Room",
        html: `
          <h2>Payment Failed</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your payment of <strong>£${(invoice.totalAmount / 100).toFixed(2)}</strong> has failed.</p>
          <p>Your ability to book new shoots has been paused until this is resolved. Please contact us.</p>
        `,
      }).catch((err) => console.error("Failed to send client failure email:", err));

      // Notify Harrison
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: HARRISON_EMAIL,
        subject: `Payment Failed: ${client.companyName} — £${(invoice.totalAmount / 100).toFixed(2)}`,
        html: `
          <h2>Payment Failed</h2>
          <p><strong>Client:</strong> ${client.companyName} (${client.contactName})</p>
          <p><strong>Amount:</strong> £${(invoice.totalAmount / 100).toFixed(2)}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Client bookings have been automatically paused.</p>
        `,
      }).catch((err) => console.error("Failed to send admin failure email:", err));
    }
  }
}

async function handleMandateEvent(event: GoCardlessEvent) {
  const mandateId = event.links.mandate;

  if (event.action === "active") {
    // Mandate successfully set up — store on client
    const customerId = event.links.customer;

    // Find client by GoCardless customer ID or by mandate
    await db
      .update(clients)
      .set({
        gocardlessMandateId: mandateId,
        gocardlessCustomerId: customerId || null,
      })
      .where(eq(clients.gocardlessCustomerId, customerId));
  } else if (event.action === "cancelled" || event.action === "failed") {
    // Mandate no longer valid
    const clientRows = await db
      .select()
      .from(clients)
      .where(eq(clients.gocardlessMandateId, mandateId))
      .limit(1);

    if (clientRows.length > 0) {
      const client = clientRows[0];

      await db
        .update(clients)
        .set({
          gocardlessMandateId: null,
          bookingsPaused: 1,
        })
        .where(eq(clients.id, client.id));

      // Notify both parties
      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: client.email,
        subject: "Payment Method No Longer Valid — The Property Room",
        html: `
          <h2>Payment Method Invalid</h2>
          <p>Hi ${client.contactName},</p>
          <p>Your Direct Debit mandate is no longer valid. Please log in to set up a new payment method.</p>
          <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/portal/account/setup-mandate">Set up payment</a></p>
        `,
      }).catch((err) => console.error("Failed to send mandate email:", err));

      resend.emails.send({
        from: "Harrison <harrison@thepropertyroom.co>",
        to: HARRISON_EMAIL,
        subject: `Mandate Cancelled: ${client.companyName}`,
        html: `
          <h2>Mandate Cancelled</h2>
          <p><strong>Client:</strong> ${client.companyName} (${client.contactName})</p>
          <p>Their Direct Debit mandate has been ${event.action}. Bookings have been paused.</p>
        `,
      }).catch((err) => console.error("Failed to send mandate admin email:", err));
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhook/gocardless/
git commit -m "feat: add GoCardless webhook handler for payments and mandates"
```

---

## Task 16: Admin clients pages

**Files:**
- Create: `src/app/admin/clients/page.tsx`
- Create: `src/app/admin/clients/page.module.css`
- Create: `src/app/admin/clients/[id]/page.tsx`
- Create: `src/app/admin/clients/[id]/page.module.css`

- [ ] **Step 1: Create admin clients list page**

Create `src/app/admin/clients/page.tsx` — follows the same pattern as the existing `/admin/bookings/page.tsx`. Shows filterable/searchable list of clients with status badges, running balance, and mandate status. Clicking a client navigates to `/admin/clients/[id]`.

- [ ] **Step 2: Create admin client detail page**

Create `src/app/admin/clients/[id]/page.tsx` — four sections:

1. **Overview**: company details, status with approve/suspend/deactivate buttons, mandate status, bookings paused toggle
2. **Running Balance**: list of completed bookings with checkboxes, total, "Charge" button that POSTs to `/api/admin/clients/[id]/charge` with selected booking IDs
3. **Booking History**: all client bookings, filterable by status
4. **Invoice History**: all invoices with status, retry button for failed ones, PDF download links

Follow existing admin page patterns — use `AdminNav`, same CSS module patterns, same card/table styles.

- [ ] **Step 3: Create styles for both pages**

Create `src/app/admin/clients/page.module.css` and `src/app/admin/clients/[id]/page.module.css` matching the existing admin design language.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/clients/
git commit -m "feat: add admin clients list and detail pages with charge flow"
```

---

## Task 17: Update AdminNav and existing admin pages

**Files:**
- Modify: `src/app/admin/components/AdminNav.tsx`
- Modify: `src/app/api/admin/bookings/route.ts`
- Modify: `src/app/admin/bookings/page.tsx`

- [ ] **Step 1: Add Clients link to AdminNav**

In `src/app/admin/components/AdminNav.tsx`, add a "Clients" link after "Bookings":

```tsx
<Link
  href="/admin/clients"
  className={`${styles.link} ${pathname?.startsWith('/admin/clients') ? styles.active : ''}`}
>
  Clients
</Link>
```

- [ ] **Step 2: Update bookings API to include new statuses and client info**

In `src/app/api/admin/bookings/route.ts`, update the valid statuses in the PATCH handler:

```typescript
const validStatuses = ["confirmed", "completed", "cancelled", "invoiced", "paid", "payment_failed"];
```

Also update the GET handler to join client company name. Modify the select to include client info:

```typescript
import { clients } from "@/lib/schema";

// In GET handler, replace the simple select with a left join:
const rows = await db
  .select({
    id: bookings.id,
    address: bookings.address,
    postcode: bookings.postcode,
    bedrooms: bookings.bedrooms,
    preferredDate: bookings.preferredDate,
    startTime: bookings.startTime,
    endTime: bookings.endTime,
    notes: bookings.notes,
    agentName: bookings.agentName,
    agentCompany: bookings.agentCompany,
    agentEmail: bookings.agentEmail,
    agentPhone: bookings.agentPhone,
    services: bookings.services,
    workHours: bookings.workHours,
    subtotal: bookings.subtotal,
    discountCode: bookings.discountCode,
    discountAmount: bookings.discountAmount,
    total: bookings.total,
    stripeSession: bookings.stripeSession,
    status: bookings.status,
    createdAt: bookings.createdAt,
    clientId: bookings.clientId,
    clientCompanyName: clients.companyName,
  })
  .from(bookings)
  .leftJoin(clients, eq(bookings.clientId, clients.id))
  .where(conditions.length ? and(...conditions) : undefined)
  .orderBy(bookings.preferredDate);
```

- [ ] **Step 3: Update bookings page to show client info and new statuses**

In `src/app/admin/bookings/page.tsx`:

1. Add `clientId` and `clientCompanyName` to the `Booking` interface
2. Update `StatusFilter` type to include `"invoiced" | "paid" | "payment_failed"`
3. Add the new status tabs
4. Show client company name in booking cards (e.g. "Foxtons" badge or "One-off" if no clientId)
5. Add the new status button options in the expanded card actions

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/components/AdminNav.tsx src/app/api/admin/bookings/route.ts src/app/admin/bookings/page.tsx
git commit -m "feat: update admin nav and bookings page for account clients"
```

---

## Task 18: Update admin calendar for account client bookings

**Files:**
- Modify: `src/app/admin/calendar/page.tsx`

- [ ] **Step 1: Update calendar to show account client indicators**

Read the current calendar page, then modify it to:

1. Add `clientId` and `clientCompanyName` to the booking data (the API already returns it from Task 17)
2. Show a visual indicator for account client bookings — add a small company name badge or different colour indicator next to the address
3. Show booking status on calendar entries (e.g. small dot or text like "pending" vs "completed")

The changes should be minimal — just adding visual differentiation, not restructuring the calendar.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/calendar/page.tsx
git commit -m "feat: add account client indicators to admin calendar"
```

---

## Task 19: Client email templates

**Files:**
- Create: `src/lib/client-emails.ts`

- [ ] **Step 1: Create dedicated client email module**

Create `src/lib/client-emails.ts` that exports helper functions for the more complex email templates (booking cancellation with details, etc.). The simpler notification emails are already inline in the API routes from previous tasks. This file handles any emails that need richer formatting:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Harrison <harrison@thepropertyroom.co>";

interface BookingCancelledData {
  contactName: string;
  email: string;
  address: string;
  postcode: string | null;
  preferredDate: string;
}

export async function sendBookingCancelledEmail(data: BookingCancelledData) {
  const date = new Date(data.preferredDate + "T12:00:00").toLocaleDateString(
    "en-GB",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" }
  );

  await resend.emails.send({
    from: FROM,
    to: data.email,
    subject: `Booking Cancelled: ${data.address} — The Property Room`,
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi ${data.contactName},</p>
      <p>The following booking has been cancelled:</p>
      <p><strong>${data.address}${data.postcode ? `, ${data.postcode}` : ""}</strong></p>
      <p>${date}</p>
      <p>If you have any questions, please reply to this email.</p>
    `,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/client-emails.ts
git commit -m "feat: add client email template helpers"
```

---

## Task 20: Environment variables and final verification

**Files:**
- Modify: `.env.local` (manual step — not committed)

- [ ] **Step 1: Document required new environment variables**

The following environment variables need to be added to `.env.local`:

```
CLIENT_JWT_SECRET=<generate a random 64-char hex string>
GOCARDLESS_ACCESS_TOKEN=<from GoCardless dashboard>
GOCARDLESS_ENVIRONMENT=sandbox
GOCARDLESS_WEBHOOK_SECRET=<from GoCardless dashboard webhook setup>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Run the build to verify no TypeScript errors**

```bash
npm run build
```

Fix any type errors that arise from the new code.

- [ ] **Step 3: Run the dev server and verify pages load**

```bash
npm run dev
```

Manually verify:
- `/portal/login` loads
- `/portal/signup` loads
- `/admin/clients` loads (when logged in as admin)
- No console errors

- [ ] **Step 4: Commit any build fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from account clients feature"
```
