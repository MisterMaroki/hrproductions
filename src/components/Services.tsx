"use client";

import Link from "next/link";
import SectionHeader from "./SectionHeader";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./Services.module.css";

const services = [
  {
    name: "Photography",
    price: "From £130",
    details: ["£6.50 per photo · Min 20 per property", "10% off for 100+ photos"],
  },
  {
    name: "Drone Photography",
    price: "From £75",
    details: ["8 photos — £75", "20 photos — £140"],
  },
  {
    name: "Unpresented Property Video",
    price: "From £100",
    details: ["2-bed base · +£25 per extra bedroom", "Add drone footage for +£65"],
  },
  {
    name: "Agent Presented Video",
    price: "From £150",
    details: [
      "Guided tour with your agent on camera",
      "Directed by Harrison · +£25 per extra bedroom",
    ],
  },
];

export default function Services() {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <SectionHeader title="Services" id="services" />
        <div className={styles.grid}>
          {services.map((service) => (
            <div key={service.name} className={styles.card}>
              <h3 className={styles.name}>{service.name}</h3>
              <p className={styles.price}>{service.price}</p>
              {service.details.map((line) => (
                <p key={line} className={styles.detail}>
                  {line}
                </p>
              ))}
              <Link href="/book" className={styles.bookLink}>
                Book Now &#8594;
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
