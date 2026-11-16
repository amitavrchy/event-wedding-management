"use client";
import Link from "next/link";
import "@/app/account.css";

/** Centered card used by the public account pages (reset, verify). */
export function AccountFlow({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="account-flow">
      <section>
        <Link className="brand" href="/">
          utsab<span>✳</span>
        </Link>
        <h1>{title}</h1>
        {intro && <p className="account-flow-intro">{intro}</p>}
        {children}
      </section>
    </main>
  );
}
