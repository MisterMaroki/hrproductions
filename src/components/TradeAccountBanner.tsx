"use client";

import Link from "next/link";
import { useFadeIn } from "@/hooks/useFadeIn";
import styles from "./TradeAccountBanner.module.css";

export default function TradeAccountBanner() {
  const ref = useFadeIn<HTMLElement>();

  return (
    <section ref={ref} className={`${styles.section} fade-in`}>
      <div className={styles.container}>
        <div className={styles.inner}>
          <div className={styles.content}>
            <span className={styles.label}>For Estate Agents</span>
            <h2 className={styles.heading}>
              Book on credit with a trade account
            </h2>
            <p className={styles.description}>
              Skip the checkout. Book unlimited shoots each month and receive a
              single invoice collected automatically via Direct Debit.
            </p>
          </div>
          <div className={styles.features}>
            <div className={styles.feature}>
              <span className={styles.featureNumber}>01</span>
              <span className={styles.featureText}>
                No upfront payment per shoot
              </span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureNumber}>02</span>
              <span className={styles.featureText}>
                One monthly invoice via Direct Debit
              </span>
            </div>
            <div className={styles.feature}>
              <span className={styles.featureNumber}>03</span>
              <span className={styles.featureText}>
                Dedicated client portal to manage bookings
              </span>
            </div>
          </div>
          <div className={styles.actions}>
            <Link href="/portal/signup" className={styles.primaryCta}>
              Open a Trade Account
            </Link>
            <Link href="/portal/login" className={styles.secondaryCta}>
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
