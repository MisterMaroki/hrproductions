"use client";

import { useCallback, useState } from "react";
import type { PropertyBooking, AgentInfo, SelectedService } from "./BookingSection";
import { isWhiteLabel } from "@/lib/brand";
import { evaluatePrice, calcMultiPropertyDiscount, type PricingRules } from "@/lib/pricing-engine";
import styles from "./Basket.module.css";

interface Props {
  properties: PropertyBooking[];
  agent: AgentInfo;
  discountCode: string;
  discountPercentage: number;
  onValidate: () => boolean;
  serviceCategories: any[]; // ResolvedCategory[]
}

type CheckoutMode = "choose" | "pay" | "account" | "whitelabel";

function getLineItems(property: PropertyBooking, allServices: any[]) {
  const items: { label: string; price: number; indent?: boolean }[] = [];

  for (const sel of property.selectedServices) {
    const svc = allServices.find((s: any) => s.id === sel.serviceId);
    if (!svc) continue;

    const inputs = { ...sel.inputs, bedrooms: property.bedrooms };
    const result = evaluatePrice(svc.pricingRules as PricingRules, inputs);

    items.push({
      label: svc.name,
      price: result.total,
      indent: svc.isAddon,
    });
  }

  return items;
}

export default function Basket({ properties, agent, discountCode, discountPercentage, onValidate, serviceCategories }: Props) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<CheckoutMode>(isWhiteLabel() ? "whitelabel" : "choose");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountConfirm, setAccountConfirm] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountSuccess, setAccountSuccess] = useState(false);

  const allServices = serviceCategories.flatMap((c: any) => c.services);

  const propertyTotals = properties.map((p) => {
    const items = getLineItems(p, allServices);
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return { property: p, items, subtotal };
  });

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

  const [wlSuccess, setWlSuccess] = useState(false);
  const [wlLoggedIn, setWlLoggedIn] = useState(false);

  const handleWhitelabelSubmit = useCallback(async () => {
    if (!onValidate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/whitelabel/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties, agent, discountCode, discountPercentage }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }
      const sessionRes = await fetch("/api/portal/dashboard");
      setWlLoggedIn(sessionRes.ok);
      setWlSuccess(true);
    } catch (err) {
      console.error("Whitelabel booking error:", err);
      alert("Something went wrong. Please try again.");
    } finally {
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

      {/* Checkout flow */}
      {wlSuccess ? (
        <div className={styles.accountSuccess}>
          <div className={styles.accountSuccessIcon}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="16" fill="#0a0a0a"/><path d="M10 16.5L14 20.5L22 12.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/></svg>
          </div>
          <h4 className={styles.accountSuccessTitle}>Booking Confirmed</h4>
          <p className={styles.accountSuccessText}>
            Thanks {agent.name}. We&apos;ve received your booking.{" "}
            {wlLoggedIn ? (
              <>
                You can view it in <a href="/portal/bookings" className={styles.accountSuccessLink}>your bookings</a>.
              </>
            ) : (
              <>
                <a href="/portal/login" className={styles.accountSuccessLink}>Sign in</a> to view your bookings.
              </>
            )}
          </p>
        </div>
      ) : mode === "whitelabel" ? (
        <button
          className={styles.checkout}
          onClick={handleWhitelabelSubmit}
          disabled={!hasItems || loading}
        >
          {loading ? "Submitting..." : "Submit Booking"}
        </button>
      ) : accountSuccess ? (
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
          <button
            className={styles.backToOptions}
            onClick={() => setMode("choose")}
            disabled={loading}
          >
            Back to options
          </button>
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
