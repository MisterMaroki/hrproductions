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
  photography: boolean;
  photoCount: number;
  standardVideo: boolean;
  agentPresentedVideo: boolean;
  drone: boolean;
}

function createProperty(): PropertyBooking {
  return {
    id: crypto.randomUUID(),
    address: "",
    bedrooms: 2,
    preferredDate: "",
    photography: false,
    photoCount: 20,
    standardVideo: false,
    agentPresentedVideo: false,
    drone: false,
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
          </div>
          <div className={styles.basket}>
            <Basket properties={properties} agent={agent} />
          </div>
        </div>
      </div>
    </section>
  );
}
