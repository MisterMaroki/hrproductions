import Nav from "@/components/Nav";
import BookingSection from "@/components/BookingSection";
import Footer from "@/components/Footer";
import styles from "./page.module.css";

export const metadata = {
  title: "Book a Shoot — The Property Room",
  description:
    "Book your property photography and video shoot online.",
};

export default function BookPage() {
  return (
    <>
      <Nav bookPage />
      <main className={styles.wrapper}>
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
        <BookingSection />
      </main>
      <Footer />
    </>
  );
}
