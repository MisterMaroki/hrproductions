import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcMultiPropertyDiscount,
  type PropertyServices,
} from "@/lib/pricing";

let _stripe: Stripe;
function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

interface PropertyPayload extends PropertyServices {
  id: string;
  address: string;
  postcode: string;
  preferredDate: string;
  notes: string;
}

interface CheckoutBody {
  properties: PropertyPayload[];
  agent: {
    name: string;
    company: string;
    email: string;
    phone: string;
  };
  discountCode?: string;
  discountPercentage?: number;
}

function buildLineItems(
  properties: PropertyPayload[],
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

  for (const p of properties) {
    const label = p.address || "Property";

    if (p.photography) {
      const price = calcPhotography(p.photoCount);
      const bulkApplied = p.photoCount >= 100;
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Photography (${p.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
    }

    if (p.dronePhotography) {
      const price = calcDronePhotography(p.dronePhotoCount);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Drone Photography (${p.dronePhotoCount} photos)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
    }

    if (p.agentPresentedVideo) {
      const price = calcAgentPresentedVideo(p.bedrooms);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Agent Presented Video (${p.bedrooms}-bed)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
      if (p.agentPresentedVideoDrone) {
        items.push({
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Drone Footage (with Agent Presented Video)",
              description: label,
            },
            unit_amount: Math.round(calcVideoDrone() * 100),
          },
          quantity: 1,
        });
      }
    } else if (p.standardVideo) {
      const price = calcStandardVideo(p.bedrooms);
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Unpresented Property Video (${p.bedrooms}-bed)`,
            description: label,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      });
      if (p.standardVideoDrone) {
        items.push({
          price_data: {
            currency: "gbp",
            product_data: {
              name: "Drone Footage (with Unpresented Video)",
              description: label,
            },
            unit_amount: Math.round(calcVideoDrone() * 100),
          },
          quantity: 1,
        });
      }
    }
  }

  return items;
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

    const lineItems = buildLineItems(properties);

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
      metadata[`property_${i}`] = JSON.stringify({
        address: p.address,
        postcode: p.postcode,
        bedrooms: p.bedrooms,
        preferredDate: p.preferredDate,
        notes: p.notes,
        photography: p.photography,
        photoCount: p.photoCount,
        dronePhotography: p.dronePhotography,
        dronePhotoCount: p.dronePhotoCount,
        standardVideo: p.standardVideo,
        standardVideoDrone: p.standardVideoDrone,
        agentPresentedVideo: p.agentPresentedVideo,
        agentPresentedVideoDrone: p.agentPresentedVideoDrone,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      ...(discounts.length > 0 ? { discounts } : {}),
      customer_email: agent.email || undefined,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/#book`,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
