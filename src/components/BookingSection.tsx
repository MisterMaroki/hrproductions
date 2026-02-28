"use client";

import { useState, useCallback, useMemo } from "react";
import SectionHeader from "./SectionHeader";
import AgentDetails from "./AgentDetails";
import PropertyBlock from "./PropertyBlock";
import type { SiblingBooking } from "./PropertyBlock";
import Basket from "./Basket";
import { useFadeIn } from "@/hooks/useFadeIn";
import { isWorkingDay, calcShootMinutes } from "@/lib/scheduling";
import styles from "./BookingSection.module.css";

export interface AgentInfo {
  name: string;
  company: string;
  email: string;
  phone: string;
}

export interface PropertyBooking {
  id: string;
  address: string;
  postcode: string;
  bedrooms: number;
  preferredDate: string;
  timeSlot: string; // "HH:MM" start time
  notes: string;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
  socialMediaVideo: boolean;
  socialMediaPresentedVideo: boolean;
  floorPlan: boolean;
  floorPlanVirtualTour: boolean;
}

export interface ValidationErrors {
  agent: Partial<Record<keyof AgentInfo, string>>;
  properties: Record<string, Record<string, string>>;
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    postcode: "",
    bedrooms: 2,
    preferredDate: "",
    timeSlot: "",
    notes: "",
    photography: false,
    photoCount: 20,
    dronePhotography: false,
    dronePhotoCount: 8,
    standardVideo: false,
    standardVideoDrone: false,
    agentPresentedVideo: false,
    agentPresentedVideoDrone: false,
    socialMediaVideo: false,
    socialMediaPresentedVideo: false,
    floorPlan: false,
    floorPlanVirtualTour: false,
  };
}

export default function BookingSection() {
  const ref = useFadeIn<HTMLElement>();
  const [agent, setAgent] = useState<AgentInfo>({
    name: "",
    company: "",
    email: "",
    phone: "",
  });
  const [properties, setProperties] = useState<PropertyBooking[]>([
    createProperty(),
  ]);

  const [discountCode, setDiscountCode] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [appliedCode, setAppliedCode] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({ agent: {}, properties: {} });

  const validate = useCallback((): boolean => {
    const agentErrors: ValidationErrors["agent"] = {};
    const propErrors: ValidationErrors["properties"] = {};

    if (!agent.name.trim()) agentErrors.name = "Name is required";
    if (!agent.company.trim()) agentErrors.company = "Company is required";
    if (!agent.email.trim()) {
      agentErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(agent.email)) {
      agentErrors.email = "Enter a valid email";
    }
    if (!agent.phone.trim()) {
      agentErrors.phone = "Phone is required";
    } else {
      // Strip spaces, dashes, parens
      const cleaned = agent.phone.replace(/[\s\-()]/g, "");
      // UK mobile: 07xxx or +447xxx — 11 digits from 0, 12 from +44
      // UK landline: 01x/02x/03x or +441/+442/+443 — 10-11 digits from 0
      const isValid = /^(?:0[1-37]\d{8,9}|(?:\+44|0044)[1-37]\d{8,9})$/.test(cleaned);
      if (!isValid) agentErrors.phone = "Enter a valid UK phone number";
    }

    for (const p of properties) {
      const pErr: Record<string, string> = {};
      if (!p.address.trim()) pErr.address = "Address is required";
      if (!p.postcode.trim()) {
        pErr.postcode = "Postcode is required";
      } else {
        const pc = p.postcode.replace(/\s/g, "").toUpperCase();
        if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(pc)) {
          pErr.postcode = "Enter a valid UK postcode";
        }
      }
      if (!p.preferredDate) {
        pErr.preferredDate = "Date is required";
      } else {
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (new Date(p.preferredDate) < tomorrow) {
          pErr.preferredDate = "Date must be in the future";
        } else if (!isWorkingDay(p.preferredDate)) {
          pErr.preferredDate = "We only operate Monday – Saturday";
        }
      }
      const hasServices = p.photography || p.dronePhotography || p.standardVideo || p.agentPresentedVideo || p.socialMediaVideo || p.socialMediaPresentedVideo || p.floorPlan || p.floorPlanVirtualTour;
      if (hasServices && !p.timeSlot) {
        pErr.timeSlot = "Please select a time slot";
      }
      if (p.photography && p.photoCount < 20) pErr.photoCount = "Minimum 20 photos";
      if (Object.keys(pErr).length > 0) propErrors[p.id] = pErr;
    }

    const hasErrors =
      Object.keys(agentErrors).length > 0 ||
      Object.keys(propErrors).length > 0;

    setErrors({ agent: agentErrors, properties: propErrors });

    if (hasErrors) {
      setTimeout(() => {
        const el = document.querySelector("[data-validation-error]");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }

    return !hasErrors;
  }, [agent, properties]);

  const clearAgentError = useCallback((field: keyof AgentInfo) => {
    setErrors((prev) => {
      if (!prev.agent[field]) return prev;
      const { [field]: _, ...rest } = prev.agent;
      return { ...prev, agent: rest };
    });
  }, []);

  const clearPropertyError = useCallback((propertyId: string, field: string) => {
    setErrors((prev) => {
      const propErrors = prev.properties[propertyId];
      if (!propErrors?.[field]) return prev;
      const { [field]: _, ...rest } = propErrors;
      const properties = { ...prev.properties };
      if (Object.keys(rest).length === 0) {
        delete properties[propertyId];
      } else {
        properties[propertyId] = rest;
      }
      return { ...prev, properties };
    });
  }, []);

  const addProperty = () =>
    setProperties((prev) => [...prev, createProperty()]);

  const updateProperty = (id: string, updates: Partial<PropertyBooking>) =>
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

  const removeProperty = (id: string) =>
    setProperties((prev) => prev.filter((p) => p.id !== id));

  // Build sibling booking info so each PropertyBlock can exclude
  // time slots already claimed by other properties in this booking
  const siblingMap = useMemo(() => {
    const map = new Map<string, SiblingBooking[]>();
    for (const p of properties) {
      const siblings: SiblingBooking[] = properties
        .filter((s) => s.id !== p.id && s.preferredDate && s.timeSlot)
        .map((s) => ({
          date: s.preferredDate,
          timeSlot: s.timeSlot,
          durationMins: calcShootMinutes(s),
        }));
      map.set(p.id, siblings);
    }
    return map;
  }, [properties]);

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Book" id="book" />
        <div className={styles.layout}>
          <div className={styles.form}>
            <AgentDetails agent={agent} onChange={setAgent} errors={errors.agent} onClearError={clearAgentError} />
            {properties.map((property) => (
              <PropertyBlock
                key={property.id}
                property={property}
                siblingBookings={siblingMap.get(property.id) || []}
                onChange={(updates) => updateProperty(property.id, updates)}
                onRemove={() => removeProperty(property.id)}
                canRemove={properties.length > 1}
                errors={errors.properties[property.id]}
                onClearError={(field) => clearPropertyError(property.id, field)}
              />
            ))}
            <button className={styles.addProperty} onClick={addProperty}>
              + Add Another Property
            </button>

            <div className={styles.disclaimer}>
              <h4 className={styles.disclaimerTitle}>Important Information</h4>
              <ul className={styles.disclaimerList}>
                <li>Shoot times are allocated automatically based on your selected services. Available time slots are shown after you choose a date.</li>
                <li>Properties must include a full address. Shoots within 10 miles of Brighton are included. Properties beyond 10 miles will incur a per-mile travel charge, quoted separately.</li>
                <li>Multi-property bookings on the same day receive £15 off each additional property.</li>
                <li>All prices are exclusive of VAT.</li>
              </ul>
            </div>
          </div>
          <div className={styles.basket}>
            <div className={styles.discountInput}>
              <div className={styles.discountRow}>
                <input
                  className={styles.discountField}
                  type="text"
                  placeholder="Discount code"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  disabled={!!appliedCode}
                />
                {appliedCode ? (
                  <button
                    className={styles.discountRemove}
                    onClick={() => {
                      setAppliedCode("");
                      setDiscountPercentage(0);
                      setDiscountCode("");
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    className={styles.discountApply}
                    onClick={async () => {
                      if (!discountCode.trim()) return;
                      try {
                        const res = await fetch("/api/discount/validate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ code: discountCode }),
                        });
                        if (!res.ok) {
                          const data = await res.json();
                          alert(data.error || "Invalid code");
                          return;
                        }
                        const data = await res.json();
                        setAppliedCode(data.code);
                        setDiscountPercentage(data.percentage);
                      } catch {
                        alert("Failed to validate code");
                      }
                    }}
                  >
                    Apply
                  </button>
                )}
              </div>
              {appliedCode && (
                <p className={styles.discountApplied}>
                  {appliedCode}: {discountPercentage}% off applied
                </p>
              )}
            </div>
            <Basket
              properties={properties}
              agent={agent}
              discountCode={appliedCode}
              discountPercentage={discountPercentage}
              onValidate={validate}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
