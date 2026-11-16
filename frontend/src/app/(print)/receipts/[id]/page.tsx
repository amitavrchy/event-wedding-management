"use client";
import { use, useEffect, useState } from "react";
import "@/app/tools.css";
import { api } from "@/lib/api";
import { dateLabel, taka } from "@/lib/format";
import { Button } from "@/components/ui";

type Receipt = {
  receiptNumber: string;
  issuedAt: string;
  vendor: { businessName: string; city: string };
  plan: string;
  period: { startsAt: string; endsAt: string };
  amountMinor: number;
  method: string;
  reference: string;
  issuer: string;
};

export default function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    void api<Receipt>(`subscription-payments/${id}/receipt`)
      .then(setReceipt)
      .catch((e) => setError(e.message));
  }, [id]);
  if (error) return <p className="form-error legal-page">{error}</p>;
  if (!receipt) return <p className="legal-page">Loading…</p>;
  return (
    <main className="quote-print">
      <header>
        <div>
          <h1>Payment receipt</h1>
          <p>{receipt.issuer}</p>
        </div>
        <div>
          <strong>{receipt.receiptNumber}</strong>
          <p>{dateLabel(receipt.issuedAt)}</p>
        </div>
      </header>
      <p>
        Received from <strong>{receipt.vendor.businessName}</strong>,{" "}
        {receipt.vendor.city}
      </p>
      <table>
        <tbody>
          <tr>
            <td>
              {receipt.plan} plan · {dateLabel(receipt.period.startsAt)} –{" "}
              {dateLabel(receipt.period.endsAt)}
            </td>
            <td>{taka(receipt.amountMinor)}</td>
          </tr>
          <tr className="total">
            <td>
              Total paid ({receipt.method} {receipt.reference})
            </td>
            <td>{taka(receipt.amountMinor)}</td>
          </tr>
        </tbody>
      </table>
      <Button className="no-print" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
    </main>
  );
}
