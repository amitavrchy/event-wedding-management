import Link from "next/link";
import "@/app/tools.css";

/** Shared layout for policy pages. Content is a draft until reviewed by counsel. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="legal-page">
      <Link className="brand" href="/">
        utsab<span>✳</span>
      </Link>
      <h1>{title}</h1>
      <p className="muted">Last updated {updated}</p>
      <p className="legal-note">
        Draft for review. This text has not yet been approved by a lawyer and
        must be finalised before commercial launch.
      </p>
      {children}
      <nav className="account-flow-links">
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/refund-policy">Refunds & cancellations</Link>
      </nav>
    </main>
  );
}
