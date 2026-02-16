import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Payment Confirmed — Harrison Ross",
};

export default function SuccessPage() {
  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Thank you</h1>
        <p className={styles.body}>
          Your payment has been received. We&rsquo;ll be in touch shortly to
          confirm the details of your booking.
        </p>
        <Link href="/" className={styles.link}>
          Back to homepage
        </Link>
      </div>
    </main>
  );
}
