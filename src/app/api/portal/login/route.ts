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
