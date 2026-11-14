import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata: Metadata = { title: "Privacy policy" };
export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="14 November 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, mobile number, language.</li>
        <li>
          Planning records you create: events, guest names and contact details,
          RSVPs, budgets, gifts, photos.
        </li>
        <li>
          Vendor business details and verification documents (seen only by our
          review team).
        </li>
        <li>
          Technical data: device and browser, IP address and sign-in history,
          used for security.
        </li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>
          To provide the service, send invitations, reminders and booking
          updates.
        </li>
        <li>
          To keep accounts secure (verification codes, fraud prevention, sign-in
          alerts).
        </li>
        <li>
          To connect hosts and vendors when a host sends an inquiry. A vendor
          sees your contact details only after you contact them.
        </li>
      </ul>
      <h2>Sharing</h2>
      <p>
        We do not sell personal data. We use service providers for email, SMS,
        push notifications, file storage and hosting, under agreements that
        limit their use of your data. Guest details are not sent to any
        artificial-intelligence service.
      </p>
      <h2>Guests</h2>
      <p>
        If a host adds you as a guest, the host controls that information. Your
        RSVP link is private to you; anyone with the link can reply on your
        behalf, so do not share it publicly.
      </p>
      <h2>Retention and deletion</h2>
      <p>
        You can delete your account from Account &amp; security. We remove your
        personal details immediately and keep only records we must retain by law
        (for example, payment receipts).
      </p>
      <h2>Your choices</h2>
      <p>
        You can change your language and notification settings, end sessions on
        other devices, and request a copy of your data by contacting support.
      </p>
    </LegalPage>
  );
}
