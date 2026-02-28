import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { bookings, discountCodes } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { calcWorkHours } from "@/lib/scheduling";
import {
  calcPropertyTotal,
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcSocialMediaVideo,
  calcSocialMediaPresentedVideo,
  calcFloorPlan,
  calcFloorPlanVirtualTour,
  type PropertyServices,
} from "@/lib/pricing";
import { sendBookingEmails } from "@/lib/email";

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
          socialMediaVideo: p.socialMediaVideo || false,
          socialMediaPresentedVideo: p.socialMediaPresentedVideo || false,
          floorPlan: p.floorPlan || false,
          floorPlanVirtualTour: p.floorPlanVirtualTour || false,
        };

        const subtotal = Math.round(calcPropertyTotal(services) * 100);
        const discountAmount = discountPercentage
          ? Math.round(subtotal * (discountPercentage / 100))
          : 0;
        const total = subtotal - discountAmount;

        const workHours = calcWorkHours({
          photography: p.photography,
          photoCount: p.photoCount || 20,
          dronePhotography: p.dronePhotography,
          standardVideo: p.standardVideo,
          standardVideoDrone: p.standardVideoDrone || false,
          agentPresentedVideo: p.agentPresentedVideo,
          agentPresentedVideoDrone: p.agentPresentedVideoDrone || false,
          socialMediaVideo: p.socialMediaVideo || false,
          socialMediaPresentedVideo: p.socialMediaPresentedVideo || false,
          floorPlan: p.floorPlan || false,
          floorPlanVirtualTour: p.floorPlanVirtualTour || false,
          bedrooms: p.bedrooms,
        });

        // Calculate end time from start time + shoot duration
        let startTime: string | null = p.timeSlot || null;
        let endTime: string | null = null;
        if (startTime) {
          const [h, m] = startTime.split(":").map(Number);
          const endMins = h * 60 + m + Math.round(workHours * 60);
          const endH = Math.floor(endMins / 60);
          const endM = endMins % 60;
          endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
        }

        await db.insert(bookings).values({
          id: crypto.randomUUID(),
          address: p.address,
          postcode: p.postcode || null,
          bedrooms: p.bedrooms,
          preferredDate: p.preferredDate,
          startTime,
          endTime,
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

      // ── Send confirmation invoice + notification emails ──
      try {
        const emailProperties = properties.map((p: Record<string, unknown>) => {
          const services: { name: string; amount: number }[] = [];

          if (p.photography) {
            const count = (p.photoCount as number) || 20;
            services.push({
              name: `Photography (${count} photos)`,
              amount: Math.round(calcPhotography(count) * 100),
            });
          }
          if (p.dronePhotography) {
            const count = (p.dronePhotoCount as 8 | 20) || 8;
            services.push({
              name: `Drone Photography (${count} photos)`,
              amount: Math.round(calcDronePhotography(count) * 100),
            });
          }
          if (p.agentPresentedVideo) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Agent Presented Video (${beds}-bed)`,
              amount: Math.round(calcAgentPresentedVideo(beds) * 100),
            });
            if (p.agentPresentedVideoDrone) {
              services.push({
                name: "Drone Footage (with Agent Presented Video)",
                amount: Math.round(calcVideoDrone() * 100),
              });
            }
          } else if (p.standardVideo) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Unpresented Property Video (${beds}-bed)`,
              amount: Math.round(calcStandardVideo(beds) * 100),
            });
            if (p.standardVideoDrone) {
              services.push({
                name: "Drone Footage (with Unpresented Video)",
                amount: Math.round(calcVideoDrone() * 100),
              });
            }
          }

          if (p.socialMediaPresentedVideo) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Social Media Video — Presented (${beds}-bed)`,
              amount: Math.round(calcSocialMediaPresentedVideo(beds) * 100),
            });
          } else if (p.socialMediaVideo) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Social Media Video — Unpresented (${beds}-bed)`,
              amount: Math.round(calcSocialMediaVideo(beds) * 100),
            });
          }

          if (p.floorPlanVirtualTour) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Floor Plan + Virtual Tour (${beds}-bed)`,
              amount: Math.round(calcFloorPlanVirtualTour(beds) * 100),
            });
          } else if (p.floorPlan) {
            const beds = (p.bedrooms as number) || 2;
            services.push({
              name: `Floor Plan (${beds}-bed)`,
              amount: Math.round(calcFloorPlan(beds) * 100),
            });
          }

          const subtotal = services.reduce((s, svc) => s + svc.amount, 0);

          return {
            address: p.address as string,
            postcode: (p.postcode as string) || null,
            bedrooms: (p.bedrooms as number) || 2,
            preferredDate: p.preferredDate as string,
            startTime: (p.timeSlot as string) || null,
            endTime: (() => {
              const slot = p.timeSlot as string | undefined;
              if (!slot) return null;
              const svc: PropertyServices = {
                bedrooms: (p.bedrooms as number) || 2,
                photography: !!p.photography,
                photoCount: (p.photoCount as number) || 20,
                dronePhotography: !!p.dronePhotography,
                dronePhotoCount: ((p.dronePhotoCount as 8 | 20) || 8),
                standardVideo: !!p.standardVideo,
                standardVideoDrone: !!p.standardVideoDrone,
                agentPresentedVideo: !!p.agentPresentedVideo,
                agentPresentedVideoDrone: !!p.agentPresentedVideoDrone,
                socialMediaVideo: !!p.socialMediaVideo,
                socialMediaPresentedVideo: !!p.socialMediaPresentedVideo,
                floorPlan: !!p.floorPlan,
                floorPlanVirtualTour: !!p.floorPlanVirtualTour,
              };
              const wh = calcWorkHours(svc);
              const [h, m] = slot.split(":").map(Number);
              const endMins = h * 60 + m + Math.round(wh * 60);
              return `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
            })(),
            services,
            subtotal,
          };
        });

        const grandSubtotal = emailProperties.reduce(
          (s: number, p: { subtotal: number }) => s + p.subtotal,
          0,
        );
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
