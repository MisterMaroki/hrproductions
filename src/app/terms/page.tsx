import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import styles from "./legal.module.css";

export const metadata = {
  title: "Terms & Conditions — The Property Room",
  description: "Terms and conditions for using our property media services.",
};

export default function TermsPage() {
  return (
    <>
      <Nav bookPage />
      <main className={styles.wrapper}>
        <div className={styles.banner}>
          <div className={styles.bannerInner}>
            <h1 className={styles.bannerHeadline}>Terms &amp; Conditions</h1>
            <p className={styles.updated}>Last updated: 29 March 2026</p>
          </div>
        </div>
        <div className={styles.content}>
          <section>
            <h2>1. Services</h2>
            <p>
              The Property Room provides property photography, drone photography,
              property videography, and related visual media services
              (&ldquo;Services&rdquo;). By booking a shoot, you agree to these terms.
            </p>
          </section>

          <section>
            <h2>2. Bookings &amp; Scheduling</h2>
            <ul>
              <li>
                Bookings are confirmed once payment has been received via our online
                checkout.
              </li>
              <li>
                Shoot times are allocated based on availability and your selected
                services. We operate Monday to Saturday.
              </li>
              <li>
                We require at least 24 hours&apos; notice for bookings. Same-day bookings
                are not available.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Pricing &amp; Payment</h2>
            <ul>
              <li>All prices displayed are exclusive of VAT unless stated otherwise.</li>
              <li>Payment is taken at the time of booking via Stripe.</li>
              <li>
                Multi-property bookings on the same day receive &pound;15 off each
                additional property.
              </li>
              <li>
                Properties beyond 10 miles of Brighton may incur a travel surcharge,
                which will be quoted separately.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Trade Accounts &amp; Credit Terms</h2>
            <ul>
              <li>
                By opening a trade account, you enter into a binding agreement to pay
                for all services booked through your account. Each booking placed
                constitutes a contractual obligation to pay the invoiced amount in full.
              </li>
              <li>
                Trade account holders are invoiced monthly via Direct Debit. Payment is
                collected automatically on or around the date shown on each invoice.
              </li>
              <li>
                It is your responsibility to ensure sufficient funds are available for
                collection. If a Direct Debit payment fails, your account will be
                suspended and no further bookings may be placed until the outstanding
                balance is settled.
              </li>
              <li>
                Invoices not paid within 14 days of the due date will incur a late
                payment fee of 8% above the Bank of England base rate, in accordance
                with the Late Payment of Commercial Debts (Interest) Act 1998.
              </li>
              <li>
                If payment remains outstanding after 30 days, we reserve the right to
                instruct a third-party debt recovery agency or commence legal
                proceedings to recover the full amount owed, including any accrued
                interest, administration charges, and reasonable legal costs.
              </li>
              <li>
                We may, at our sole discretion, suspend, restrict, or terminate your
                trade account at any time. Outstanding balances remain payable
                regardless of account status.
              </li>
            </ul>
          </section>

          <section>
            <h2>5. Cancellations &amp; Rescheduling</h2>
            <ul>
              <li>
                Cancellations made more than 48 hours before the scheduled shoot will
                receive a full refund.
              </li>
              <li>
                Cancellations within 48 hours of the shoot may be subject to a 50%
                cancellation fee.
              </li>
              <li>
                We reserve the right to reschedule shoots due to adverse weather
                conditions (particularly for drone work). You will be notified as soon
                as possible and offered an alternative date at no extra cost.
              </li>
            </ul>
          </section>

          <section>
            <h2>6. Access &amp; Property</h2>
            <ul>
              <li>
                You are responsible for ensuring we have access to the property at the
                scheduled time, including any keys, lockbox codes, or parking
                arrangements.
              </li>
              <li>
                Properties should be prepared and presented for photography/video before
                our arrival.
              </li>
              <li>
                If we are unable to access the property at the scheduled time, the
                booking may be treated as a late cancellation.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. Deliverables &amp; Usage</h2>
            <ul>
              <li>
                Edited photos and videos will be delivered digitally within an agreed
                timeframe, typically 24&ndash;48 hours for photography and 3&ndash;5
                working days for video.
              </li>
              <li>
                You are granted a licence to use the delivered media for property
                marketing purposes. Copyright remains with The Property Room.
              </li>
              <li>
                We may use delivered media in our own portfolio, website, and social
                media unless you request otherwise in writing.
              </li>
            </ul>
          </section>

          <section>
            <h2>8. Drone Photography &amp; Videography</h2>
            <p>
              All drone operations are conducted in compliance with UK Civil Aviation
              Authority (CAA) regulations. Flights may be cancelled or limited due to
              weather, airspace restrictions, or site conditions. If drone work cannot
              be completed, you will be refunded for the drone portion of the booking.
            </p>
          </section>

          <section>
            <h2>9. Liability</h2>
            <p>
              We take reasonable care during shoots but are not liable for any damage
              to property or belongings unless caused by our negligence. Our total
              liability shall not exceed the value of the booking.
            </p>
          </section>

          <section>
            <h2>10. Changes to These Terms</h2>
            <p>
              We may update these terms from time to time. The latest version will
              always be available on this page.
            </p>
          </section>

          <section>
            <h2>11. Contact</h2>
            <p>
              For any questions about these terms, contact us at{" "}
              <a href="mailto:hello@harrisonross.co.uk">hello@harrisonross.co.uk</a>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
