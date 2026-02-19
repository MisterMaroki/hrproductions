"use client";

import { useCallback, useState } from "react";
import type { PropertyBooking, AgentInfo } from "./BookingSection";
import {
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcPropertyTotal,
  calcMultiPropertyDiscount,
} from "@/lib/pricing";
import styles from "./Basket.module.css";

interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
  discountCode: string;
  discountPercentage: number;
  onValidate: () => boolean;
}

function getLineItems(property: PropertyBooking) {
  const items: { label: string; price: number; indent?: boolean }[] = [];

  if (property.photography) {
    const price = calcPhotography(property.photoCount);
    const bulkApplied = property.photoCount >= 100;
    items.push({
      label: `Photography (${property.photoCount} photos)${bulkApplied ? " — 10% off" : ""}`,
      price,
    });
  }

  if (property.dronePhotography) {
    items.push({
      label: `Drone Photography (${property.dronePhotoCount} photos)`,
      price: calcDronePhotography(property.dronePhotoCount),
    });
  }

  if (property.agentPresentedVideo) {
    items.push({
      label: `Agent Presented Video (${property.bedrooms}-bed)`,
      price: calcAgentPresentedVideo(property.bedrooms),
    });
    if (property.agentPresentedVideoDrone) {
      items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
    }
  } else if (property.standardVideo) {
    items.push({
      label: `Unpresented Video (${property.bedrooms}-bed)`,
      price: calcStandardVideo(property.bedrooms),
    });
    if (property.standardVideoDrone) {
      items.push({ label: "Drone footage", price: calcVideoDrone(), indent: true });
    }
  }

  return items;
}

export default function Basket({ properties, agent, discountCode, discountPercentage, onValidate }: Props) {
  const [loading, setLoading] = useState(false);

  const propertyTotals = properties.map((p) => ({
    property: p,
    items: getLineItems(p),
    subtotal: calcPropertyTotal(p),
  }));

  const subtotalBeforeDiscount = propertyTotals.reduce((sum, p) => sum + p.subtotal, 0);
  const discount = calcMultiPropertyDiscount(properties.length);
  const codeDiscountAmount = discountPercentage > 0
    ? Math.round((subtotalBeforeDiscount - discount) * (discountPercentage / 100) * 100) / 100
    : 0;
  const grandTotal = Math.max(0, subtotalBeforeDiscount - discount - codeDiscountAmount);
  const hasItems = subtotalBeforeDiscount > 0;

  const handleCheckout = useCallback(async () => {
    if (!onValidate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties, agent, discountCode, discountPercentage }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [properties, agent, discountCode, discountPercentage, onValidate]);

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
              <div key={item.label} className={`${styles.lineItem} ${item.indent ? styles.indented : ""}`}>
                <span>{item.indent ? `+ ${item.label}` : item.label}</span>
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

      {discount > 0 && (
        <div className={styles.discountLine}>
          <span>Multi-property discount ({properties.length} properties)</span>
          <span>-£{discount.toFixed(2)}</span>
        </div>
      )}

      {codeDiscountAmount > 0 && (
        <div className={styles.discountLine}>
          <span>Discount ({discountCode}: {discountPercentage}% off)</span>
          <span>-£{codeDiscountAmount.toFixed(2)}</span>
        </div>
      )}

      <div className={styles.total}>
        <span>Total</span>
        <span>£{grandTotal.toFixed(2)}</span>
      </div>

      <button
        className={styles.checkout}
        onClick={handleCheckout}
        disabled={!hasItems || loading}
      >
        {loading ? "Redirecting…" : "Proceed to Payment"}
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

      {/* Mobile basket — always visible */}
      <div className={styles.mobile}>
        <h3 className={styles.heading}>Your Booking</h3>
        {hasItems ? (
          basketContent
        ) : (
          <p className={styles.empty}>Select services to get started</p>
        )}
      </div>
    </>
  );
}
