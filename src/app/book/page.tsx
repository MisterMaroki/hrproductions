import Nav from "@/components/Nav";
import BookingSection from "@/components/BookingSection";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import { isWhiteLabel } from "@/lib/brand";
import styles from "./page.module.css";

export const metadata = {
  title:
    process.env.NEXT_PUBLIC_BRAND_MODE === "whitelabel" || process.env.BRAND_MODE === "whitelabel"
      ? "Book a Shoot"
      : "Book a Shoot — The Property Room",
  description:
    "Book your property photography and video shoot online.",
};

export default function BookPage() {
  const whiteLabel = isWhiteLabel();

  return (
    <>
      <Nav bookPage />
      <main className={styles.wrapper}>
        {!whiteLabel && (
          <div className={styles.banner}>
            <div className={styles.bannerInner}>
              <p className={styles.bannerLabel}>Book a Shoot</p>
              <h1 className={styles.bannerHeadline}>
                Get your listing
                <br />
                market‑ready.
              </h1>
            </div>
          </div>
        )}
        <BookingSection />
        {!whiteLabel && (
          <>
            <p className={styles.contactPrompt}>
              Want to discuss a project? Get in touch below.
            </p>
            <Contact />
          </>
        )}
      </main>
      {!whiteLabel && <Footer />}
    </>
  );
}
