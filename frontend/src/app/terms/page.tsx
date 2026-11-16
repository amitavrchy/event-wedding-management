import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata: Metadata = { title: "Terms of service" };
export default function Terms() {
  return (
    <LegalPage title="Terms of service" updated="14 November 2026">
      <h2>1. Who we are</h2>
      <p>
        The service is operated in Bangladesh by the company named on our
        invoices (&ldquo;we&rdquo;). By creating an account you agree to these
        terms.
      </p>
      <h2>2. Accounts</h2>
      <p>
        You must give accurate details, keep your password private and be at
        least 18 years old. You are responsible for activity on your account.
        You can delete your account at any time from Account &amp; security.
      </p>
      <h2>3. Planning tools</h2>
      <p>
        Hosts may use the planning tools free of charge. Guest lists, budgets
        and other planning records belong to you. You confirm you have
        permission to store the contact details of the guests you add.
      </p>
      <h2>4. Vendors and the marketplace</h2>
      <p>
        Vendors are independent businesses. We do not provide event services
        ourselves and are not a party to agreements between hosts and vendors
        unless we say so in writing. Vendors must describe their services and
        prices honestly, hold the licences their work requires and respond to
        inquiries in good faith.
      </p>
      <p>
        Listings marked <strong>Sponsored</strong> are paid placements. A{" "}
        <strong>Verified</strong> badge means we reviewed the documents the
        vendor provided on the date shown; it is not a guarantee of service
        quality.
      </p>
      <h2>5. Payments</h2>
      <p>
        Unless a booking page says otherwise, payments for event services are
        made directly between host and vendor. Amounts recorded in the app are
        records, not proof that money changed hands. Vendor subscription fees
        are paid to us as described in our refund policy.
      </p>
      <h2>6. Reviews and content</h2>
      <p>
        Only hosts with a completed booking can review a vendor. Do not post
        content that is false, abusive, infringes someone else&rsquo;s rights or
        contains other people&rsquo;s private information. We may remove content
        that breaks these rules.
      </p>
      <h2>7. Acceptable use</h2>
      <p>
        Do not misuse the service: no scraping, spam, fake accounts, attempts to
        access other people&rsquo;s data, or interference with the service.
      </p>
      <h2>8. Liability</h2>
      <p>
        The service is provided as is. To the extent the law allows, we are not
        liable for losses arising from services provided by vendors or from
        events outside our reasonable control.
      </p>
      <h2>9. Changes and contact</h2>
      <p>
        We will notify you of material changes. Questions: contact our support
        team using the details in the app.
      </p>
    </LegalPage>
  );
}
