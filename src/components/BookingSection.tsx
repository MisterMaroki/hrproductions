"use client";

import { useState } from "react";
import SectionHeader from "./SectionHeader";
import AgentDetails from "./AgentDetails";
import PropertyBlock from "./PropertyBlock";
import Basket from "./Basket";
import { useFadeIn } from "@/hooks/useFadeIn";
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
  bedrooms: number;
  preferredDate: string;
  notes: string;
  photography: boolean;
  photoCount: number;
  dronePhotography: boolean;
  dronePhotoCount: 8 | 20;
  standardVideo: boolean;
  standardVideoDrone: boolean;
  agentPresentedVideo: boolean;
  agentPresentedVideoDrone: boolean;
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    bedrooms: 2,
    preferredDate: "",
    notes: "",
    photography: false,
    photoCount: 20,
    dronePhotography: false,
    dronePhotoCount: 8,
    standardVideo: false,
    standardVideoDrone: false,
    agentPresentedVideo: false,
    agentPresentedVideoDrone: false,
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

  const addProperty = () =>
    setProperties((prev) => [...prev, createProperty()]);

  const updateProperty = (id: string, updates: Partial<PropertyBooking>) =>
    setProperties((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );

  const removeProperty = (id: string) =>
    setProperties((prev) => prev.filter((p) => p.id !== id));

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Book" id="book" number="03 — Get Started" />
        <div className={styles.layout}>
          <div className={styles.form}>
            <AgentDetails agent={agent} onChange={setAgent} />
            {properties.map((property) => (
              <PropertyBlock
                key={property.id}
                property={property}
                onChange={(updates) => updateProperty(property.id, updates)}
                onRemove={() => removeProperty(property.id)}
                canRemove={properties.length > 1}
              />
            ))}
            <button className={styles.addProperty} onClick={addProperty}>
              + Add Another Property
            </button>

            <div className={styles.disclaimer}>
              <h4 className={styles.disclaimerTitle}>Important Information</h4>
              <ul className={styles.disclaimerList}>
                <li>Unpresented property videos are allocated 1 hour per shoot. Agent-presented videos are allocated 2 hours. Additional time may incur extra charges.</li>
                <li>Properties must include a full address. Shoots within 10 miles of Brighton are included. Properties beyond 10 miles will incur a per-mile travel charge, quoted separately.</li>
                <li>Multi-property bookings on the same day receive £15 off each additional property.</li>
                <li>All prices are exclusive of VAT.</li>
              </ul>
            </div>
          </div>
          <div className={styles.basket}>
            <Basket properties={properties} agent={agent} />
          </div>
        </div>
      </div>
    </section>
  );
}
