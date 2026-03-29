import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { bookings } from "@/lib/schema";
import {
  evaluatePrice,
  evaluateDuration,
  calcMultiPropertyDiscount,
  type PricingRules,
} from "@/lib/pricing-engine";
import { getServicesForBrand } from "@/lib/services";
import { getBrandMode } from "@/lib/brand";

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

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

interface CheckoutBody {
  properties: PropertyPayload[];
  agent: { name: string; company: string; email: string; phone: string };
  discountCode?: string;
  discountPercentage?: number;
}

function formatSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function calcShootMinsForLabel(p: PropertyPayload, allServices: { id: string; durationRules: any }[]): number {
  return p.selectedServices.reduce((total, sel) => {
    const svc = allServices.find(s => s.id === sel.serviceId);
    if (!svc) return total;
    return total + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: p.bedrooms });
  }, 0);
}

function formatBookingLabel(p: PropertyPayload, allServices: { id: string; durationRules: any }[]): string {
  const parts: string[] = [p.address || "Property"];

  if (p.preferredDate) {
    const date = new Date(p.preferredDate + "T12:00:00");
    const day = date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    parts.push(day);
  }

  if (p.timeSlot) {
    const shootMins = calcShootMinsForLabel(p, allServices);
    const [h, m] = p.timeSlot.split(":").map(Number);
    const endTotal = h * 60 + m + shootMins;
    const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, "0")}:${String(endTotal % 60).padStart(2, "0")}`;
    parts.push(`${formatSlotTime(p.timeSlot)} – ${formatSlotTime(endTime)}`);
  }

  return parts.join(" · ");
}

async function buildLineItems(properties: PropertyPayload[]) {
  const categories = await getServicesForBrand(getBrandMode());
  const allServices = categories.flatMap(c => c.services);

  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const p of properties) {
    const label = formatBookingLabel(p, allServices);

    for (const sel of p.selectedServices) {
      const svc = allServices.find(s => s.id === sel.serviceId);
      if (!svc) continue;

      const inputs = { ...sel.inputs, bedrooms: p.bedrooms };
      const result = evaluatePrice(svc.pricingRules, inputs);

      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: svc.name,
            description: label,
          },
          unit_amount: Math.round(result.total * 100),
        },
        quantity: 1,
      });
    }
  }

  return { items, allServices };
}

function calcTotalDiscountPence(
  properties: PropertyPayload[],
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[],
  discountPercentage?: number,
): number {
  let total = 0;

  const multiDiscount = calcMultiPropertyDiscount(properties.length);
  total += Math.round(multiDiscount * 100);

  if (discountPercentage && discountPercentage > 0) {
    const serviceTotal = lineItems.reduce(
      (sum, item) => sum + ((item.price_data as { unit_amount: number }).unit_amount),
      0,
    );
    const afterMulti = serviceTotal - Math.round(multiDiscount * 100);
    total += Math.round(afterMulti * (discountPercentage / 100));
  }

  return total;
}

export async function POST(request: Request) {
  try {
    const body: CheckoutBody = await request.json();
    const { properties, agent, discountCode, discountPercentage } = body;

    if (!properties?.length) {
      return NextResponse.json(
        { error: "No properties provided" },
        { status: 400 }
      );
    }

    const { items: lineItems, allServices } = await buildLineItems(properties);

    if (!lineItems.length) {
      return NextResponse.json(
        { error: "No services selected" },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    // Build discounts via Stripe coupon instead of negative line items
    const totalDiscountPence = calcTotalDiscountPence(
      properties,
      lineItems,
      discountPercentage,
    );

    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (totalDiscountPence > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: totalDiscountPence,
        currency: "gbp",
        duration: "once",
        name: [
          properties.length > 1 ? `Multi-property (${properties.length})` : "",
          discountCode ? `${discountCode}: ${discountPercentage}% off` : "",
        ].filter(Boolean).join(" + "),
      });
      discounts.push({ coupon: coupon.id });
    }

    // Store each property in its own metadata key to stay under Stripe's 500-char limit
    const metadata: Record<string, string> = {
      agent_name: agent.name,
      agent_company: agent.company,
      agent_email: agent.email,
      agent_phone: agent.phone,
      discount_code: discountCode || "",
      discount_percentage: String(discountPercentage || 0),
      property_count: String(properties.length),
    };

    for (let i = 0; i < properties.length; i++) {
      const p = properties[i];
      metadata[`prop_${i}_info`] = JSON.stringify({
        a: p.address,
        pc: p.postcode,
        b: p.bedrooms,
        d: p.preferredDate,
        t: p.timeSlot,
        n: (p.notes || "").slice(0, 100),
      });
      metadata[`prop_${i}_svc`] = JSON.stringify(
        p.selectedServices.map(s => ({ id: s.serviceId, in: s.inputs }))
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      ...(discounts.length > 0 ? { discounts } : {}),
      customer_email: agent.email || undefined,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/book`,
      metadata,
    });

    // ── Save pending bookings BEFORE redirecting to Stripe ──
    const discountPct = discountPercentage || 0;
    for (const p of properties) {
      const servicesData = p.selectedServices.map(sel => {
        const svc = allServices.find(s => s.id === sel.serviceId);
        return {
          serviceId: sel.serviceId,
          serviceName: svc?.name ?? "Unknown",
          inputs: sel.inputs,
          computedPrice: svc
            ? evaluatePrice(svc.pricingRules, { ...sel.inputs, bedrooms: p.bedrooms }).total
            : 0,
        };
      });

      const workHours =
        Math.round(
          (p.selectedServices.reduce((total, sel) => {
            const svc = allServices.find(s => s.id === sel.serviceId);
            if (!svc) return total;
            return total + evaluateDuration(svc.durationRules, { ...sel.inputs, bedrooms: p.bedrooms });
          }, 0) / 60) * 100
        ) / 100;

      const subtotal = Math.round(
        servicesData.reduce((sum, s) => sum + s.computedPrice, 0) * 100
      );
      const propDiscount = discountPct ? Math.round(subtotal * (discountPct / 100)) : 0;
      const total = subtotal - propDiscount;

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
        agentName: agent.name,
        agentCompany: agent.company || null,
        agentEmail: agent.email,
        agentPhone: agent.phone || null,
        services: JSON.stringify(servicesData),
        workHours,
        subtotal,
        discountCode: discountCode || null,
        discountAmount: propDiscount,
        total,
        stripeSession: session.id,
        status: "pending",
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
