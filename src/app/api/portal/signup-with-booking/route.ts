import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clients, bookings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/client-auth";
import { evaluatePrice, evaluateDuration } from "@/lib/pricing-engine";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const HARRISON_EMAIL = "harrison@thepropertyroom.co";
const FROM = "Harrison <harrison@thepropertyroom.co>";

interface SelectedServicePayload {
  serviceId: string;
  inputs: Record<string, number | string | boolean>;
}

export async function POST(request: Request) {
  try {
    const { account, properties } = await request.json();

    const categories = await getServicesForBrand(getBrandMode());
    const allServices = categories.flatMap(c => c.services);

    if (
      !account?.companyName ||
      !account?.contactName ||
      !account?.email ||
      !account?.phone ||
      !account?.password
    ) {
      return NextResponse.json(
        { error: "All account fields are required" },
        { status: 400 }
      );
    }

    if (account.password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!properties?.length) {
      return NextResponse.json(
        { error: "No properties provided" },
        { status: 400 }
      );
    }

    // Check email doesn't already exist
    const existing = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.email, account.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists. Log in at /portal/login to book on your account." },
        { status: 409 }
      );
    }

    // Create client account
    const passwordHash = await hashPassword(account.password);
    const clientId = crypto.randomUUID();

    await db.insert(clients).values({
      id: clientId,
      companyName: account.companyName,
      contactName: account.contactName,
      email: account.email.toLowerCase(),
      phone: account.phone,
      passwordHash,
      status: "pending_approval",
    });

    // Create bookings
    const createdIds: string[] = [];

    for (const p of properties) {
      const servicesData = p.selectedServices.map((sel: SelectedServicePayload) => {
        const svc = allServices.find(s => s.id === sel.serviceId);
        return {
          serviceId: sel.serviceId,
          serviceName: svc?.name ?? "Unknown",
          inputs: sel.inputs,
          computedPrice: svc ? evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms }).total : 0,
        };
      });

      const subtotal = Math.round(servicesData.reduce((sum: number, s: { computedPrice: number }) => sum + s.computedPrice, 0) * 100); // pence
      const total = subtotal;

      const workHours = Math.round((p.selectedServices.reduce((acc: number, sel: SelectedServicePayload) => {
        const svc = allServices.find(s => s.id === sel.serviceId);
        if (!svc) return acc;
        return acc + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: p.bedrooms });
      }, 0) / 60) * 100) / 100;

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
        agentName: account.contactName,
        agentCompany: account.companyName,
        agentEmail: account.email,
        agentPhone: account.phone,
        services: JSON.stringify(servicesData),
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

    // Notify Harrison — signup + booking
    const addresses = properties
      .map((p: { address: string }) => p.address)
      .join(", ");

    resend.emails
      .send({
        from: FROM,
        to: HARRISON_EMAIL,
        subject: `New Account Signup + Booking: ${account.companyName}`,
        html: `
        <h2>New Account Signup with Booking</h2>
        <p><strong>Company:</strong> ${account.companyName}</p>
        <p><strong>Contact:</strong> ${account.contactName}</p>
        <p><strong>Email:</strong> ${account.email}</p>
        <p><strong>Phone:</strong> ${account.phone}</p>
        <h3>Bookings (${properties.length})</h3>
        <ul>${properties.map((p: { address: string; preferredDate: string }) => `<li>${p.address} — ${p.preferredDate}</li>`).join("")}</ul>
        <p>Log in to the admin panel to approve this account.</p>
      `,
      })
      .catch((err: unknown) =>
        console.error("Failed to send signup+booking notification:", err)
      );

    return NextResponse.json({ success: true, bookingIds: createdIds });
  } catch (err) {
    console.error("Signup with booking error:", err);
    return NextResponse.json(
      { error: "Failed to create account and booking" },
      { status: 500 }
    );
  }
}
