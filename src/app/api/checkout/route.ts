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
  discountCode?: string,
  discountPercentage?: number,
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

  // Multi-property discount
  const discount = calcMultiPropertyDiscount(properties.length);
  if (discount > 0) {
    items.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: `Multi-property discount (${properties.length} properties)`,
        },
        unit_amount: -Math.round(discount * 100),
      },
      quantity: 1,
    });
  }

  // Discount code
  if (discountPercentage && discountPercentage > 0) {
    const serviceTotal = items
      .filter((item) => (item.price_data as { unit_amount: number }).unit_amount > 0)
      .reduce((sum, item) => sum + (item.price_data as { unit_amount: number }).unit_amount, 0);
    const codeDiscountPence = Math.round(serviceTotal * (discountPercentage / 100));
    if (codeDiscountPence > 0) {
      items.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Discount code (${discountCode || ""}): ${discountPercentage}% off`,
          },
          unit_amount: -codeDiscountPence,
        },
        quantity: 1,
      });
    }
  }

  return items;
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

    const lineItems = buildLineItems(properties, discountCode, discountPercentage);

    // Filter out any discount-only submissions
    const serviceItems = lineItems.filter(
      (item) => (item.price_data as { unit_amount: number }).unit_amount > 0
    );

    if (!serviceItems.length) {
      return NextResponse.json(
        { error: "No services selected" },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: agent.email || undefined,
      success_url: `${origin}/success`,
      cancel_url: `${origin}/#book`,
      metadata: {
        agent_name: agent.name,
        agent_company: agent.company,
        agent_email: agent.email,
        agent_phone: agent.phone,
        discount_code: discountCode || "",
        discount_percentage: String(discountPercentage || 0),
        properties: JSON.stringify(
          properties.map((p) => ({
            address: p.address,
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
          }))
        ),
      },
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
