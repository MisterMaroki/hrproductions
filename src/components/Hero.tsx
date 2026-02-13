import Image from "next/image";
import styles from "./Hero.module.css";

export default function Hero() {
  return (
    <section className={styles.hero}>
      <Image
        src="/images/IMG_2905.JPG"
        alt="Property interior by Harrison Ross"
        fill
        priority
        style={{ objectFit: "cover" }}
      />
      <div className={styles.overlay} />
      <div className={styles.content}>
        <h1 className={styles.title}>Harrison Ross</h1>
        <p className={styles.subtitle}>
          Property videography &amp; photography for estate agents
        </p>
        <a href="#book" className={styles.cta}>
          Book a Shoot
        </a>
      </div>
      <div className={styles.arrow}>&#8595;</div>
    </section>
  );
}
