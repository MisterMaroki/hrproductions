"use client";

import { useState } from "react";
import type { PropertyBooking, AgentInfo } from "./BookingSection";
import {
  calcPhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcDrone,
  calcPropertyTotal,
} from "@/lib/pricing";
import styles from "./Basket.module.css";

interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
}

function getLineItems(property: PropertyBooking) {
  const items: { label: string; price: number }[] = [];

  if (property.photography) {
    const price = calcPhotography(property.photoCount);
    const bulkApplied = property.photoCount >= 100;
    items.push({
      label: `Photography (${property.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
      price,
    });
  }

  if (property.agentPresentedVideo) {
    items.push({
      label: `Agent Presented Video (${property.bedrooms}-bed)`,
      price: calcAgentPresentedVideo(property.bedrooms),
    });
  } else if (property.standardVideo) {
    items.push({
      label: `Property Video (${property.bedrooms}-bed)`,
      price: calcStandardVideo(property.bedrooms),
    });
  }

  const hasVideo = property.standardVideo || property.agentPresentedVideo;
  if (property.drone && hasVideo) {
    items.push({ label: "Drone Footage", price: calcDrone() });
  }

  return items;
}

export default function Basket({ properties, agent }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const propertyTotals = properties.map((p) => ({
    property: p,
    items: getLineItems(p),
    subtotal: calcPropertyTotal(p),
  }));

  const grandTotal = propertyTotals.reduce((sum, p) => sum + p.subtotal, 0);
  const hasItems = grandTotal > 0;

  const handleCheckout = () => {
    // TODO: Replace with Stripe Checkout Session redirect when Stripe account is set up
    const orderLines = propertyTotals
      .filter(({ items }) => items.length > 0)
      .map(({ property, items, subtotal }) =>
        `${property.address || "TBC"} (${property.bedrooms}-bed, ${property.preferredDate || "date TBC"}):\n${items.map((i) => `  - ${i.label}: £${i.price.toFixed(2)}`).join("\n")}\n  Subtotal: £${subtotal.toFixed(2)}`
      )
      .join("\n\n");

    const body = `New Booking Request\n\nAgent: ${agent.name}\nCompany: ${agent.company}\nEmail: ${agent.email}\nPhone: ${agent.phone}\n\n${orderLines}\n\nTotal: £${grandTotal.toFixed(2)}`;

    const mailto = `mailto:hello@harrisonross.co.uk?subject=${encodeURIComponent(`Booking Request — £${grandTotal.toFixed(2)}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  const basketContent = (
    <>
      {propertyTotals.map(({ property, items, subtotal }) => {
        if (items.length === 0) return null;
        return (
          <div key={property.id} className={styles.property}>
            <p className={styles.address}>
              {property.address || "No address yet"}
            </p>
            {items.map((item) => (
              <div key={item.label} className={styles.lineItem}>
                <span>{item.label}</span>
                <span>£{item.price.toFixed(2)}</span>
              </div>
            ))}
            <div className={styles.propertySubtotal}>
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
          </div>
        );
      })}

      <div className={styles.total}>
        <span>Total</span>
        <span>£{grandTotal.toFixed(2)}</span>
      </div>

      <button
        className={styles.checkout}
        onClick={handleCheckout}
        disabled={!hasItems}
      >
        Proceed to Payment
      </button>
    </>
  );

  return (
    <>
      {/* Desktop basket */}
      <div className={styles.desktop}>
        <h3 className={styles.heading}>Your Booking</h3>
        {hasItems ? (
          basketContent
        ) : (
          <p className={styles.empty}>Select services to get started</p>
        )}
      </div>

      {/* Mobile bottom bar */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileBarInner}>
          <button
            className={styles.mobileToggle}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "Hide Basket" : "View Basket"} — £
            {grandTotal.toFixed(2)}
          </button>
          <button
            className={styles.mobileCheckout}
            onClick={handleCheckout}
            disabled={!hasItems}
          >
            Pay
          </button>
        </div>
        {mobileOpen && (
          <div className={styles.mobilePanel}>{basketContent}</div>
        )}
      </div>
    </>
  );
}
