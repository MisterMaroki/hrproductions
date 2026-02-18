import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { bookings, discountCodes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { calcWorkHours } from "@/lib/scheduling";
import { calcPropertyTotal, type PropertyServices } from "@/lib/pricing";

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
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
      const propertyCount = Number(meta.property_count || 0);
      const properties = [];
      for (let i = 0; i < propertyCount; i++) {
        const raw = meta[`property_${i}`];
        if (raw) properties.push(JSON.parse(raw));
      }
      const discountCode = meta.discount_code || null;
      const discountPercentage = Number(meta.discount_percentage || 0);

      for (const p of properties) {
        const services: PropertyServices = {
          bedrooms: p.bedrooms,
          photography: p.photography,
          photoCount: p.photoCount,
          dronePhotography: p.dronePhotography,
          dronePhotoCount: p.dronePhotoCount,
          standardVideo: p.standardVideo,
          standardVideoDrone: p.standardVideoDrone,
          agentPresentedVideo: p.agentPresentedVideo,
          agentPresentedVideoDrone: p.agentPresentedVideoDrone,
        };

        const subtotal = Math.round(calcPropertyTotal(services) * 100);
        const discountAmount = discountPercentage
          ? Math.round(subtotal * (discountPercentage / 100))
          : 0;
        const total = subtotal - discountAmount;

        const workHours = calcWorkHours({
          photography: p.photography,
          dronePhotography: p.dronePhotography,
          standardVideo: p.standardVideo,
          agentPresentedVideo: p.agentPresentedVideo,
        });

        await db.insert(bookings).values({
          id: crypto.randomUUID(),
          address: p.address,
          postcode: p.postcode || null,
          bedrooms: p.bedrooms,
          preferredDate: p.preferredDate,
          notes: p.notes || null,
          agentName: meta.agent_name,
          agentCompany: meta.agent_company || null,
          agentEmail: meta.agent_email,
          agentPhone: meta.agent_phone || null,
          services: JSON.stringify(services),
          workHours,
          subtotal,
          discountCode,
          discountAmount,
          total,
          stripeSession: session.id,
          status: "confirmed",
        });
      }

      if (discountCode) {
        await db
          .update(discountCodes)
          .set({ timesUsed: sql`${discountCodes.timesUsed} + 1` })
          .where(eq(discountCodes.code, discountCode));
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
