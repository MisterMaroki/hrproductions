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
