import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  createClientSessionToken,
  setClientSessionCookie,
} from "@/lib/client-auth";
import { isWhiteLabel } from "@/lib/brand";
import {
  verifyWhitelabelPassword,
  createWhitelabelSessionToken,
  setWhitelabelSessionCookie,
} from "@/lib/whitelabel-auth";

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
