"use client";
import { useState } from "react";
import { useResource } from "@/lib/use-resource";
import { taka } from "@/lib/format";
import { CardHeading, Field } from "./ui";

type Report = {
  month: string;
  inquiries: number;
  respondedInquiries: number;
  responseRate: number | null;
  averageResponseMinutes: number | null;
  quotesSent: number;
  quotesAccepted: number;
  bookings: number;
  bookedValueMinor: number;
  paymentsRecordedMinor: number;
  newReviews: number;
  newReviewAverage: number | null;
};

/** Month-by-month vendor performance (also sent to the vendor on the 1st). */
export function MonthlyReport({ vendorId }: { vendorId: string }) {
  const [month, setMonth] = useState(() =>
    new Date(Date.now() + 6 * 3600000).toISOString().slice(0, 7),
  );
  const report = useResource<Report | null>(
    `vendors/${vendorId}/report?month=${month}`,
    null,
  );
  const r = report.data;
  return (
    <section className="card padded">
      <CardHeading
        title="Monthly report"
        subtitle="Inquiries, replies and bookings for the month."
        action={
          <Field label="Month">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
        }
      />
      {r && (
        <dl className="kv">
          <dt>Inquiries</dt>
          <dd>{r.inquiries}</dd>
          <dt>Reply rate</dt>
          <dd>{r.responseRate != null ? `${r.responseRate}%` : "—"}</dd>
          <dt>Average reply time</dt>
          <dd>
            {r.averageResponseMinutes != null
              ? `${r.averageResponseMinutes} min`
              : "—"}
          </dd>
          <dt>Quotations accepted</dt>
          <dd>
            {r.quotesAccepted} of {r.quotesSent}
          </dd>
          <dt>Bookings</dt>
          <dd>
            {r.bookings} · {taka(r.bookedValueMinor)}
          </dd>
          <dt>Payments recorded</dt>
          <dd>{taka(r.paymentsRecordedMinor)}</dd>
          <dt>New reviews</dt>
          <dd>
            {r.newReviews}
            {r.newReviewAverage ? ` · ${r.newReviewAverage.toFixed(1)}★` : ""}
          </dd>
        </dl>
      )}
    </section>
  );
}
