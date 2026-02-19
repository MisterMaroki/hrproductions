import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import styles from "../terms/legal.module.css";

export const metadata = {
  title: "Privacy Policy — The Property Room",
  description: "How we collect, use, and protect your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav bookPage />
      <main className={styles.wrapper}>
        <div className={styles.banner}>
          <div className={styles.bannerInner}>
            <h1 className={styles.bannerHeadline}>Privacy Policy</h1>
            <p className={styles.updated}>Last updated: 19 February 2026</p>
          </div>
        </div>
        <div className={styles.content}>
          <section>
            <h2>1. Who We Are</h2>
            <p>
              The Property Room (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) provides
              property photography, videography, and visual media services. We are
              based in Brighton, United Kingdom. For any questions about this policy,
              contact us at{" "}
              <a href="mailto:hello@harrisonross.co.uk">hello@harrisonross.co.uk</a>.
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <p>When you book a shoot or contact us, we may collect:</p>
            <ul>
              <li>Your name, email address, and phone number</li>
              <li>Your company or agency name</li>
              <li>Property addresses and postcodes for scheduled shoots</li>
              <li>Payment information (processed securely by Stripe &mdash; we do not store card details)</li>
              <li>Any notes or access instructions you provide</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use your personal data to:</p>
            <ul>
              <li>Process and manage your bookings</li>
              <li>Communicate with you about your shoots (confirmations, scheduling, delivery)</li>
              <li>Process payments via Stripe</li>
              <li>Improve our services</li>
            </ul>
            <p>
              We will never sell your personal data to third parties or use it for
              unsolicited marketing without your consent.
            </p>
          </section>

          <section>
            <h2>4. Payment Processing</h2>
            <p>
              All payments are processed securely through Stripe. We do not store or
              have access to your full card details. Stripe&apos;s privacy policy can be
              found at{" "}
              <a href="https://stripe.com/gb/privacy" target="_blank" rel="noopener noreferrer">
                stripe.com/gb/privacy
              </a>.
            </p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>
              We retain your booking information for as long as necessary to fulfil our
              services and comply with legal obligations. If you wish to have your data
              deleted, please contact us and we will action your request within 30 days.
            </p>
          </section>

          <section>
            <h2>6. Your Rights</h2>
            <p>Under UK data protection law (UK GDPR), you have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p>
              To exercise any of these rights, email us at{" "}
              <a href="mailto:hello@harrisonross.co.uk">hello@harrisonross.co.uk</a>.
            </p>
          </section>

          <section>
            <h2>7. Cookies</h2>
            <p>
              Our website uses only essential cookies required for the site to function
              (e.g. session management). We do not use advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Any changes will be
              posted on this page with an updated date.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
