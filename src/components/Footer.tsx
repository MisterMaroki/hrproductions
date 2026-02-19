import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.brand}>Harrison Ross</span>
        <div className={styles.center}>
          <span className={styles.tagline}>Property media, done right.</span>
          <div className={styles.legal}>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms &amp; Conditions</Link>
          </div>
        </div>
        <span className={styles.contact}>
          <a href="mailto:hello@harrisonross.co.uk">hello@harrisonross.co.uk</a>
        </span>
      </div>
    </footer>
  );
}
