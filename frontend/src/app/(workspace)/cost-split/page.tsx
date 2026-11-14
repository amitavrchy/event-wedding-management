"use client";
import Link from "next/link";
import { Scale } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { useResource } from "@/lib/use-resource";
import { taka } from "@/lib/format";
import { CardHeading, Empty, PageHeading } from "@/components/ui";

type Split = {
  labels: { BRIDE: string; GROOM: string };
  sharePercent: { BRIDE: number; GROOM: number };
  paidMinor: {
    BRIDE: number;
    GROOM: number;
    SHARED: number;
    UNASSIGNED: number;
  };
  totalMinor: number;
  fairShareMinor: { BRIDE: number; GROOM: number };
  contributedMinor: { BRIDE: number; GROOM: number };
  settlement: {
    from: "BRIDE" | "GROOM";
    to: "BRIDE" | "GROOM";
    amountMinor: number;
  } | null;
  unassignedMinor: number;
};

export default function CostSplit() {
  const { event } = useApp();
  const split = useResource<Split | null>(
    event ? `events/${event.id}/cost-split` : null,
    null,
  );
  if (!event) return <Empty title="Create a celebration first" />;
  const s = split.data;
  return (
    <>
      <PageHeading
        eyebrow="খরচ ভাগাভাগি"
        title="Family cost split"
        description="Who has paid what, each family's agreed share, and what settles it."
      />
      {s && (
        <>
          <section className="card settle-card">
            <Scale size={28} />
            {s.settlement ? (
              <h2>
                {s.labels[s.settlement.from]} owes {s.labels[s.settlement.to]}{" "}
                <strong>{taka(s.settlement.amountMinor)}</strong>
              </h2>
            ) : (
              <h2>Both families are even.</h2>
            )}
            <p className="muted">
              Agreed split {s.sharePercent.BRIDE}% / {s.sharePercent.GROOM}% of{" "}
              {taka(s.totalMinor)} spent.{" "}
              <Link href="/guests?view=sides">Change the split</Link>
            </p>
          </section>
          <div className="side-grid">
            {(["BRIDE", "GROOM"] as const).map((k) => (
              <section key={k} className="card padded">
                <CardHeading
                  title={s.labels[k]}
                  subtitle={`${s.sharePercent[k]}% share`}
                />
                <dl className="kv">
                  <dt>Paid directly</dt>
                  <dd>{taka(s.paidMinor[k])}</dd>
                  <dt>Share of joint payments</dt>
                  <dd>{taka(s.contributedMinor[k] - s.paidMinor[k])}</dd>
                  <dt>Fair share</dt>
                  <dd>{taka(s.fairShareMinor[k])}</dd>
                </dl>
              </section>
            ))}
          </div>
          {s.unassignedMinor > 0 && (
            <div className="info-note">
              {taka(s.unassignedMinor)} of expenses have no payer yet.{" "}
              <Link href="/budget">Mark who paid in the budget</Link> to include
              them.
            </div>
          )}
        </>
      )}
    </>
  );
}
