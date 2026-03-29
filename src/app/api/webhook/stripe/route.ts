import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { bookings, discountCodes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { sendBookingEmails } from "@/lib/email";

// ── Legacy pricing helpers (inlined for backward-compat with old boolean-flag bookings) ──

function legacyCalcPhotography(count: number): number {
  const base = count * 2.5;
  return count >= 100 ? base * 0.9 : base;
}

function legacyCalcDronePhotography(count: 8 | 20 | number): number {
  return count === 20 ? 140 : 75;
}

function legacyCalcStandardVideo(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 150, 2: 175, 3: 200, 4: 225, 5: 250 };
  return tiers[Math.min(bedrooms, 5)] ?? 250;
}

function legacyCalcAgentPresentedVideo(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 225, 2: 250, 3: 275, 4: 300, 5: 325 };
  return tiers[Math.min(bedrooms, 5)] ?? 325;
}

function legacyCalcVideoDrone(): number {
  return 65;
}

function legacyCalcSocialMediaVideo(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 125, 2: 150, 3: 175, 4: 200, 5: 225 };
  return tiers[Math.min(bedrooms, 5)] ?? 225;
}

function legacyCalcSocialMediaPresentedVideo(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 175, 2: 200, 3: 225, 4: 250, 5: 275 };
  return tiers[Math.min(bedrooms, 5)] ?? 275;
}

function legacyCalcStandardFloorPlan(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 60, 2: 70, 3: 80, 4: 90, 5: 100 };
  return tiers[Math.min(bedrooms, 5)] ?? 100;
}

function legacyCalcPremiumFloorPlan(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 90, 2: 100, 3: 110, 4: 120, 5: 130 };
  return tiers[Math.min(bedrooms, 5)] ?? 130;
}

function legacyCalcFloorPlan3D(bedrooms: number): number {
  const tiers: Record<number, number> = { 1: 120, 2: 140, 3: 160, 4: 180, 5: 200 };
  return tiers[Math.min(bedrooms, 5)] ?? 200;
}

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

/** Build a services list from the legacy boolean-flags format stored in booking.services. */
function buildLegacyServices(
  p: Record<string, unknown>
): { name: string; amount: number }[] {
  const services: { name: string; amount: number }[] = [];

  if (p.photography) {
    const count = (p.photoCount as number) || 20;
    services.push({
      name: `Photography (${count} photos)`,
      amount: Math.round(legacyCalcPhotography(count) * 100),
    });
  }
  if (p.dronePhotography) {
    const count = (p.dronePhotoCount as 8 | 20) || 8;
    services.push({
      name: `Drone Photography (${count} photos)`,
      amount: Math.round(legacyCalcDronePhotography(count) * 100),
    });
  }
  if (p.agentPresentedVideo) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Agent Presented Video (${beds}-bed)`,
      amount: Math.round(legacyCalcAgentPresentedVideo(beds) * 100),
    });
    if (p.agentPresentedVideoDrone) {
      services.push({
        name: "Drone Footage (with Agent Presented Video)",
        amount: Math.round(legacyCalcVideoDrone() * 100),
      });
    }
  } else if (p.standardVideo) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Unpresented Property Video (${beds}-bed)`,
      amount: Math.round(legacyCalcStandardVideo(beds) * 100),
    });
    if (p.standardVideoDrone) {
      services.push({
        name: "Drone Footage (with Unpresented Video)",
        amount: Math.round(legacyCalcVideoDrone() * 100),
      });
    }
  }

  if (p.socialMediaPresentedVideo) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Social Media Video — Presented (${beds}-bed)`,
      amount: Math.round(legacyCalcSocialMediaPresentedVideo(beds) * 100),
    });
  } else if (p.socialMediaVideo) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Social Media Video — Unpresented (${beds}-bed)`,
      amount: Math.round(legacyCalcSocialMediaVideo(beds) * 100),
    });
  }

  if (p.floorPlan3D) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `3D Floor Plan (${beds}-bed)`,
      amount: Math.round(legacyCalcFloorPlan3D(beds) * 100),
    });
  } else if (p.premiumFloorPlan) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Premium Floor Plan (${beds}-bed)`,
      amount: Math.round(legacyCalcPremiumFloorPlan(beds) * 100),
    });
  } else if (p.standardFloorPlan) {
    const beds = (p.bedrooms as number) || 2;
    services.push({
      name: `Standard Floor Plan (${beds}-bed)`,
      amount: Math.round(legacyCalcStandardFloorPlan(beds) * 100),
    });
  }

  return services;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
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
      const discountCode = meta.discount_code || null;
      const discountPercentage = Number(meta.discount_percentage || 0);

      // Confirm pending bookings created at checkout time
      await db
        .update(bookings)
        .set({ status: "confirmed" })
        .where(eq(bookings.stripeSession, session.id));

      if (discountCode) {
        await db
          .update(discountCodes)
          .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
          .where(eq(discountCodes.code, discountCode));
      }

      // ── Send confirmation invoice + notification emails ──
      try {
        // Fetch the just-confirmed bookings from DB
        const confirmedBookings = await db
          .select()
          .from(bookings)
          .where(eq(bookings.stripeSession, session.id));

        const emailProperties = confirmedBookings.map((booking) => {
          let services: { name: string; amount: number }[] = [];

          try {
            const parsed = JSON.parse(booking.services);

            if (Array.isArray(parsed)) {
              // New format: array of { serviceId, serviceName, inputs, computedPrice }
              services = parsed.map(
                (s: { serviceName?: string; serviceId?: string; computedPrice?: number }) => ({
                  name: s.serviceName || s.serviceId || "Service",
                  amount: Math.round((s.computedPrice ?? 0) * 100), // convert pounds → pence
                })
              );
            } else if (parsed && typeof parsed === "object") {
              // Legacy format: boolean flags object
              services = buildLegacyServices(parsed as Record<string, unknown>);
            }
          } catch {
            // If services JSON is unparseable, leave services as empty array
          }

          const subtotal = services.reduce((sum, s) => sum + s.amount, 0);

          return {
            address: booking.address,
            postcode: booking.postcode,
            bedrooms: booking.bedrooms,
            preferredDate: booking.preferredDate,
            startTime: booking.startTime,
            endTime: booking.endTime,
            services,
            subtotal,
          };
        });

        const grandSubtotal = emailProperties.reduce((s, p) => s + p.subtotal, 0);
        const totalDiscountAmount = discountPercentage
          ? Math.round(grandSubtotal * (discountPercentage / 100))
          : 0;
        const grandTotal = grandSubtotal - totalDiscountAmount;

        await sendBookingEmails({
          agentName: meta.agent_name,
          agentCompany: meta.agent_company || null,
          agentEmail: meta.agent_email,
          agentPhone: meta.agent_phone || null,
          properties: emailProperties,
          discountCode,
          discountAmount: totalDiscountAmount,
          total: grandTotal,
          stripeSession: session.id,
        });
      } catch (emailErr) {
        // Don't fail the webhook if email sending fails
        console.error("Failed to send booking emails:", emailErr);
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
