import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, bookingsWhitelabel, clients } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { getClientSession } from "@/lib/client-auth";
import { getWhitelabelSession } from "@/lib/whitelabel-auth";
import { evaluatePrice, evaluateDuration } from "@/lib/pricing-engine";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode, isWhiteLabel } from "@/lib/brand";

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

export async function POST(request: Request) {
  if (isWhiteLabel()) {
    return NextResponse.json({ error: "Not available on whitelabel" }, { status: 404 });
  }

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

    const categories = await getServicesForBrand(getBrandMode());
    const allServices = categories.flatMap(c => c.services);

    const createdIds: string[] = [];

    interface SelectedServicePayload {
      serviceId: string;
      inputs: Record<string, number | string | boolean>;
    }

    for (const p of properties) {
      const servicesData = (p.selectedServices as SelectedServicePayload[]).map((sel) => {
        const svc = allServices.find(s => s.id === sel.serviceId);
        return {
          serviceId: sel.serviceId,
          serviceName: svc?.name ?? "Unknown",
          inputs: sel.inputs,
          computedPrice: svc ? evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms }).total : 0,
        };
      });

      const subtotal = Math.round(servicesData.reduce((sum, s) => sum + s.computedPrice, 0) * 100);
      const total = subtotal;

      const workHours = Math.round(((p.selectedServices as SelectedServicePayload[]).reduce((acc, sel) => {
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
        agentName: client.contactName,
        agentCompany: client.companyName,
        agentEmail: client.email,
        agentPhone: client.phone,
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

    // Notify Harrison
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
