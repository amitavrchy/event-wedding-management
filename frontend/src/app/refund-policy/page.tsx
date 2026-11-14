import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata: Metadata = { title: "Refunds and cancellations" };
export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellations" updated="14 November 2026">
      <h2>Vendor subscriptions</h2>
      <ul>
        <li>
          A plan starts when we confirm your payment and runs for the period
          shown on your receipt.
        </li>
        <li>
          If we cannot confirm a payment, we tell you why and nothing is charged
          by us.
        </li>
        <li>
          You can ask for a full refund within 7 days of activation if you have
          received no inquiries through the platform in that time.
        </li>
        <li>
          After that, plans are not refunded for partly used periods, but you
          can choose not to renew.
        </li>
        <li>
          Refunds are returned to the original payment method within 10 working
          days.
        </li>
      </ul>
      <h2>Event services</h2>
      <p>
        Bookings, advances and cancellations of event services are agreed
        between host and vendor. Each quotation and agreement shows the
        vendor&rsquo;s own cancellation terms. If you have a problem with a
        booking, use the &ldquo;Request a review&rdquo; option on the booking
        and our team will help both sides.
      </p>
    </LegalPage>
  );
}
