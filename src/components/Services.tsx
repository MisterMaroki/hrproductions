"use client";

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
    name: "Property Video",
    price: "From £125",
    details: ["2-bed base · +£30 per extra bedroom", "Professional edit included"],
  },
  {
    name: "Drone Footage",
    price: "+£65",
    details: ["Add-on to any video package", "Aerial property & surroundings"],
  },
  {
    name: "Agent Presented Video",
    price: "From £187.50",
    details: [
      "Guided tour with your agent on camera",
      "Directed by Harrison · +£45 per extra bedroom",
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
              <a href="#book" className={styles.bookLink}>
                Book Now &#8594;
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
