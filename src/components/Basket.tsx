"use client";

import { useCallback, useState } from "react";
import type { PropertyBooking, AgentInfo } from "./BookingSection";
import { isWhiteLabel } from "@/lib/brand";
import {
  calcPhotography,
  calcDronePhotography,
  calcStandardVideo,
  calcAgentPresentedVideo,
  calcVideoDrone,
  calcSocialMediaVideo,
  calcSocialMediaPresentedVideo,
  calcStandardFloorPlan,
  calcPremiumFloorPlan,
  calcFloorPlan3D,
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

type CheckoutMode = "choose" | "pay" | "account";

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

  if (property.socialMediaPresentedVideo) {
    items.push({
      label: `Social Media Video — Presented (${property.bedrooms}-bed)`,
      price: calcSocialMediaPresentedVideo(property.bedrooms),
    });
  } else if (property.socialMediaVideo) {
    items.push({
      label: `Social Media Video — Unpresented (${property.bedrooms}-bed)`,
      price: calcSocialMediaVideo(property.bedrooms),
    });
  }

  if (property.floorPlan3D) {
    items.push({
      label: `3D Floor Plan (${property.bedrooms}-bed)`,
      price: calcFloorPlan3D(property.bedrooms),
    });
  } else if (property.premiumFloorPlan) {
    items.push({
      label: `Premium Floor Plan (${property.bedrooms}-bed)`,
      price: calcPremiumFloorPlan(property.bedrooms),
    });
  } else if (property.standardFloorPlan) {
    items.push({
      label: `Standard Floor Plan (${property.bedrooms}-bed)`,
      price: calcStandardFloorPlan(property.bedrooms),
    });
  }

  return items;
}

export default function Basket({ properties, agent, discountCode, discountPercentage, onValidate }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CheckoutMode>(isWhiteLabel() ? "pay" : "choose");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState(false);

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

  const handleAccountSignup = useCallback(async () => {
    setAccountError("");

    if (!onValidate()) return;

    if (accountPassword.length < 8) {
      setAccountError("Password must be at least 8 characters");
      return;
    }
    if (accountPassword !== accountConfirm) {
      setAccountError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/portal/signup-with-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: {
            companyName: agent.company,
            contactName: agent.name,
            email: agent.email,
            phone: agent.phone,
            password: accountPassword,
          },
          properties,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAccountError(data.error || "Failed to create account");
        setLoading(false);
        return;
      }

      setAccountSuccess(true);
      setLoading(false);
    } catch {
      setAccountError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }, [properties, agent, accountPassword, accountConfirm, onValidate]);

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

      {/* Account signup success state */}
      {accountSuccess ? (
        <div className={styles.accountSuccess}>
          <div className={styles.accountSuccessIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#0a0a0a"/><path d="M10 16.5L14 20.5L22 12.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/></svg>
          </div>
          <h4 className={styles.accountSuccessTitle}>Account Created</h4>
          <p className={styles.accountSuccessText}>
            Your booking has been submitted and your trade account is pending approval.
            We&apos;ll email you at <strong>{agent.email}</strong> once it&apos;s active.
          </p>
          <a href="/portal/login" className={styles.accountSuccessLink}>
            Go to Client Portal
          </a>
        </div>
      ) : mode === "account" ? (
        /* Inline account signup form */
        <div className={styles.accountForm}>
          <div className={styles.accountFormHeader}>
            <h4 className={styles.accountFormTitle}>Create Trade Account</h4>
            <p className={styles.accountFormSub}>
              Book on credit. One monthly invoice via Direct Debit.
            </p>
          </div>

          <div className={styles.accountPreFilled}>
            <div className={styles.accountPreFilledRow}>
              <span className={styles.accountPreFilledLabel}>Name</span>
              <span className={styles.accountPreFilledValue}>{agent.name}</span>
            </div>
            <div className={styles.accountPreFilledRow}>
              <span className={styles.accountPreFilledLabel}>Company</span>
              <span className={styles.accountPreFilledValue}>{agent.company}</span>
            </div>
            <div className={styles.accountPreFilledRow}>
              <span className={styles.accountPreFilledLabel}>Email</span>
              <span className={styles.accountPreFilledValue}>{agent.email}</span>
            </div>
          </div>

          <div className={styles.accountFields}>
            <label className={styles.accountLabel}>
              <span className={styles.accountLabelText}>Password</span>
              <input
                className={styles.accountInput}
                type="password"
                value={accountPassword}
                onChange={(e) => setAccountPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </label>
            <label className={styles.accountLabel}>
              <span className={styles.accountLabelText}>Confirm Password</span>
              <input
                className={styles.accountInput}
                type="password"
                value={accountConfirm}
                onChange={(e) => setAccountConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </label>
          </div>

          {accountError && (
            <p className={styles.accountError}>{accountError}</p>
          )}

          <button
            className={styles.accountSubmit}
            onClick={handleAccountSignup}
            disabled={!hasItems || loading}
          >
            {loading ? "Creating account..." : "Create Account & Book"}
          </button>

          <button
            className={styles.accountBack}
            onClick={() => setMode("choose")}
            disabled={loading}
          >
            Back to options
          </button>
        </div>
      ) : mode === "pay" ? (
        /* Standard Stripe checkout */
        <>
          <button
            className={styles.checkout}
            onClick={handleCheckout}
            disabled={!hasItems || loading}
          >
            {loading ? "Redirecting..." : "Proceed to Payment"}
          </button>
          {!isWhiteLabel() && (
            <button
              className={styles.backToOptions}
              onClick={() => setMode("choose")}
              disabled={loading}
            >
              Back to options
            </button>
          )}
        </>
      ) : (
        /* Choose: pay now or create account */
        <div className={styles.checkoutOptions}>
          <button
            className={styles.checkout}
            onClick={() => { setMode("pay"); }}
            disabled={!hasItems}
          >
            Pay Now
          </button>

          <div className={styles.optionDivider}>
            <span className={styles.optionDividerLine} />
            <span className={styles.optionDividerText}>or</span>
            <span className={styles.optionDividerLine} />
          </div>

          <button
            className={styles.accountOption}
            onClick={() => { setMode("account"); }}
            disabled={!hasItems}
          >
            <span className={styles.accountOptionTitle}>Open a Trade Account</span>
            <span className={styles.accountOptionSub}>Book on credit with a single monthly invoice</span>
          </button>
        </div>
      )}
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
