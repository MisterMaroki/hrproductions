"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { isWhiteLabel } from "@/lib/brand";
import styles from "./PortalNav.module.css";

export default function PortalNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/portal/dashboard" className={styles.brand}>
          {isWhiteLabel() ? "Client Portal" : "THE PROPERTY ROOM"}
        </Link>
        <div className={styles.links}>
          <Link
            href="/portal/dashboard"
            className={`${styles.link} ${pathname === "/portal/dashboard" ? styles.active : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/portal/bookings"
            className={`${styles.link} ${pathname?.startsWith("/portal/bookings") ? styles.active : ""}`}
          >
            Bookings
          </Link>
          <Link
            href="/portal/invoices"
            className={`${styles.link} ${pathname === "/portal/invoices" ? styles.active : ""}`}
          >
            Invoices
          </Link>
          {!isWhiteLabel() && (
            <Link
              href="/portal/account"
              className={`${styles.link} ${pathname?.startsWith("/portal/account") ? styles.active : ""}`}
            >
              Account
            </Link>
          )}
          <button className={styles.logout} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </nav>
  );
}
