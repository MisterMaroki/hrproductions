"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PortalNav from "../../components/PortalNav";
import styles from "./page.module.css";

export default function SetupMandatePage() {
  return (
    <Suspense fallback={<><PortalNav /><main className={styles.main}><p>Loading...</p></main></>}>
      <SetupMandateContent />
    </Suspense>
  );
}

function SetupMandateContent() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Success flow: poll for mandate confirmation
  const [polling, setPolling] = useState(false);
  const [mandateConfirmed, setMandateConfirmed] = useState(false);

  const pollMandateStatus = useCallback(async () => {
    const res = await fetch("/api/portal/account/mandate-status");
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasMandateSetup === true;
  }, []);

  useEffect(() => {
    if (!isSuccess) return;

    let stopped = false;
    setPolling(true);

    async function run() {
      // Poll up to 20 times, every 2 seconds (40s total)
      for (let i = 0; i < 20; i++) {
        if (stopped) return;
        const confirmed = await pollMandateStatus();
        if (confirmed) {
          setMandateConfirmed(true);
          setPolling(false);
          return;
        }
        await new Promise((res) => setTimeout(res, 2000));
      }
      // Timed out — still show a message
      setPolling(false);
    }

    run();
    return () => { stopped = true; };
  }, [isSuccess, pollMandateStatus]);

  async function handleSetupClick() {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/portal/account/setup-mandate", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to start mandate setup. Please try again.");
      setLoading(false);
      return;
    }

    // Redirect to GoCardless hosted page
    window.location.href = data.authorisationUrl;
  }

  return (
    <>
      <PortalNav />
      <main className={styles.main}>
        <div className={styles.container}>
          {isSuccess ? (
            <div className={styles.successBox}>
              <h1 className={styles.title}>Direct Debit Set Up</h1>

              {polling && !mandateConfirmed && (
                <div className={styles.pollingRow}>
                  <span className={styles.spinner} />
                  <p className={styles.pollingText}>Confirming your mandate, please wait...</p>
                </div>
              )}

              {mandateConfirmed && (
                <>
                  <p className={styles.successText}>
                    Your Direct Debit mandate has been confirmed. You can now book shoots.
                  </p>
                  <Link href="/portal/dashboard" className={styles.primaryBtn}>
                    Continue to Dashboard
                  </Link>
                </>
              )}

              {!polling && !mandateConfirmed && (
                <>
                  <p className={styles.successText}>
                    Your mandate submission has been received. It may take a few moments to confirm.
                    You will be notified once it is active.
                  </p>
                  <Link href="/portal/dashboard" className={styles.primaryBtn}>
                    Continue to Dashboard
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className={styles.setupBox}>
              <h1 className={styles.title}>Set Up Direct Debit</h1>
              <p className={styles.description}>
                To book shoots, you need to set up a Direct Debit mandate. You will be taken to a
                secure GoCardless page to complete the process. This takes less than two minutes.
              </p>
              <ul className={styles.bulletList}>
                <li>Payments are collected automatically after your monthly invoice is issued</li>
                <li>You will receive an email notification before any payment is taken</li>
                <li>You can cancel your mandate at any time via your bank</li>
              </ul>

              {error && <p className={styles.errorMsg}>{error}</p>}

              <button
                className={styles.primaryBtn}
                onClick={handleSetupClick}
                disabled={loading}
              >
                {loading ? "Redirecting..." : "Set Up Direct Debit"}
              </button>

              <Link href="/portal/account" className={styles.cancelLink}>
                Cancel
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
