import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookings, clients } from "@/lib/schema";
import { eq } from "drizzle-orm";
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
      const total = subtotal;

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
