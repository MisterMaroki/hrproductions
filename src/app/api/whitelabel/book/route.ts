import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bookingsWhitelabel } from "@/lib/schema";
import { computeBookingRow } from "@/lib/booking-calc";
import { getServicesForBrand } from "@/lib/services";

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

interface Body {
  properties: PropertyPayload[];
  agent: { name: string; company: string; email: string; phone: string };
  discountCode?: string;
  discountPercentage?: number;
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();
    const { properties, agent, discountCode, discountPercentage } = body;

    if (!properties?.length) {
      return NextResponse.json({ error: "No properties provided" }, { status: 400 });
    }
    if (!agent?.email || !agent?.name) {
      return NextResponse.json({ error: "Agent details required" }, { status: 400 });
    }

    const categories = await getServicesForBrand("whitelabel");
    const allServices = categories.flatMap((c) => c.services);
    const discountPct = discountPercentage || 0;

    const insertedIds: string[] = [];
    for (const p of properties) {
      const row = computeBookingRow(
        {
          id: p.id,
          address: p.address,
          postcode: p.postcode || null,
          bedrooms: p.bedrooms,
          preferredDate: p.preferredDate,
          timeSlot: p.timeSlot || null,
          notes: p.notes || "",
          selectedServices: p.selectedServices,
        },
        allServices,
        discountPct,
      );

      const id = crypto.randomUUID();
      await db.insert(bookingsWhitelabel).values({
        id,
        address: p.address,
        postcode: p.postcode || null,
        bedrooms: p.bedrooms,
        preferredDate: p.preferredDate,
        startTime: row.startTime,
        endTime: row.endTime,
        notes: p.notes || null,
        agentName: agent.name,
        agentCompany: agent.company || null,
        agentEmail: agent.email,
        agentPhone: agent.phone || null,
        services: row.services,
        workHours: row.workHours,
        subtotal: row.subtotal,
        discountCode: discountCode || null,
        discountAmount: row.discountAmount,
        total: row.total,
        status: "confirmed",
      });
      insertedIds.push(id);
    }

    return NextResponse.json({ ok: true, bookingIds: insertedIds });
  } catch (err) {
    console.error("Whitelabel booking error:", err);
    return NextResponse.json({ error: "Failed to submit booking" }, { status: 500 });
  }
}
