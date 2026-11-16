"use client";
import { use, useEffect, useState } from "react";
import { BadgeCheck } from "lucide-react";
import "@/app/tools.css";
import { api } from "@/lib/api";
import { dateLabel, taka } from "@/lib/format";
import { Badge, Button } from "@/components/ui";

type Quote = {
  id: string;
  status: string;
  amountMinor: number;
  expiresAt: string;
  breakdown: { label: string; amountMinor: number }[];
  vendor: {
    businessName: string;
    logo?: string;
    image?: string;
    city: string;
    phone?: string;
    verifiedAt?: string;
  } | null;
  event: {
    title: string;
    city: string;
    days: { id: string; name: string; startsAt: string }[];
  } | null;
};

/** Branded quotation: print or "Save as PDF" from the browser. */
export default function QuotePrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quote, setQuote] = useState<Quote | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api<Quote>(`quotes/${id}`)
      .then(setQuote)
      .catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="form-error legal-page">{error}</p>;
  if (!quote) return <p className="legal-page">Loading…</p>;
  return (
    <main className="quote-print">
      <header>
        <div>
          {quote.vendor?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={quote.vendor.logo} alt={quote.vendor.businessName} />
          ) : (
            <h2>{quote.vendor?.businessName}</h2>
          )}
          <p>
            {quote.vendor?.businessName} · {quote.vendor?.city}
            {quote.vendor?.phone ? ` · ${quote.vendor.phone}` : ""}{" "}
            {quote.vendor?.verifiedAt && (
              <BadgeCheck size={14} aria-label="Verified" />
            )}
          </p>
        </div>
        <div>
          <h1>Quotation</h1>
          <p>
            No. {quote.id.slice(-8).toUpperCase()}{" "}
            <Badge value={quote.status} />
          </p>
        </div>
      </header>
      <p>
        For <strong>{quote.event?.title}</strong>
        {quote.event?.days.length
          ? ` · ${quote.event.days.map((d) => `${d.name} ${dateLabel(d.startsAt)}`).join(", ")}`
          : ""}
      </p>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {quote.breakdown.map((line, i) => (
            <tr key={i}>
              <td>{line.label}</td>
              <td>{taka(line.amountMinor)}</td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td>{taka(quote.amountMinor)}</td>
          </tr>
        </tbody>
      </table>
      <p className="muted">Valid until {dateLabel(quote.expiresAt)}.</p>
      <Button className="no-print" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
    </main>
  );
}
