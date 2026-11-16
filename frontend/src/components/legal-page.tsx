"use client";
import Link from "next/link";
import { usePublicLocale } from "@/lib/public-i18n";
import { LanguageSwitch } from "./language-switch";
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
  const { locale } = usePublicLocale();
  const bn = locale === "bn";
  const titles: Record<string, string> = {
    "Terms of service": "সেবার শর্তাবলি",
    "Privacy policy": "গোপনীয়তা নীতি",
    "Refunds and cancellations": "ফেরত ও বাতিলকরণ",
  };
  return (
    <main className="legal-page">
      <Link className="brand" href="/">
        utsab<span>✳</span>
      </Link>
      <LanguageSwitch />
      <h1>{bn ? titles[title] || title : title}</h1>
      <p className="muted">
        {bn ? "সর্বশেষ হালনাগাদ" : "Last updated"} {updated}
      </p>
      <p className="legal-note" lang="en">
        Draft for review. This text has not yet been approved by a lawyer and
        must be finalised before commercial launch.
      </p>
      <div lang="en">{children}</div>
      <nav className="account-flow-links">
        <Link href="/terms">{bn ? "শর্তাবলি" : "Terms"}</Link>
        <Link href="/privacy">{bn ? "গোপনীয়তা" : "Privacy"}</Link>
        <Link href="/refund-policy">
          {bn ? "ফেরত ও বাতিলকরণ" : "Refunds & cancellations"}
        </Link>
      </nav>
    </main>
  );
}
