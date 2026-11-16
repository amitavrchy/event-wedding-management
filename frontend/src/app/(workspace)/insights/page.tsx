"use client";
import {
  BarChart3,
  TrendingUp,
  Users,
  Wallet,
  Activity as ActivityIcon,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { useBusiness } from "@/lib/use-business";
import { MonthlyReport } from "@/components/monthly-report";
import { useResource } from "@/lib/use-resource";
import { Activity } from "@/lib/advanced";
import { taka, dateLabel, statusLabel } from "@/lib/format";
import { Empty, Field, PageHeading } from "@/components/ui";
type Insight = {
  plannedMinor: number;
  committedMinor: number;
  actualMinor: number;
  remainingMinor: number;
  guests: {
    invited: number;
    accepted: number;
    attending: number;
    declined: number;
    seated: number;
  };
  tasks: { total: number; done: number; overdue: number };
  categories: { category: string; committedMinor: number }[];
  activity: Activity[];
  leads: number;
  won: number;
  pipelineMinor: number;
  grossMinor: number;
  commissionMinor: number;
  netMinor: number;
  outstandingPayoutMinor: number;
  confirmedBookings: number;
  monthly: { month: string; netMinor: number }[];
};
export default function Insights() {
  const { event, user } = useApp();
  const { business, businesses, choose } = useBusiness();
  const vendor = user?.role === "VENDOR";
  const { data } = useResource<Insight | null>(
    vendor && business
      ? `insights/business/${business.id}`
      : !vendor && event
        ? `insights/event/${event.id}`
        : null,
    null,
  );
  if (!data)
    return (
      <Empty title="Your insights are coming together">
        Create an event or business to see its real planning and financial
        activity.
      </Empty>
    );
  const metrics = vendor
    ? [
        ["Open pipeline", taka(data.pipelineMinor, true)],
        ["Gross captured", taka(data.grossMinor, true)],
        ["Vendor earnings", taka(data.netMinor, true)],
        ["Payout pending", taka(data.outstandingPayoutMinor, true)],
      ]
    : [
        ["Planned budget", taka(data.plannedMinor, true)],
        ["Committed", taka(data.committedMinor, true)],
        ["Actually spent", taka(data.actualMinor, true)],
        ["Budget headroom", taka(data.remainingMinor, true)],
      ];
  return (
    <>
      <PageHeading
        eyebrow="A CLEARER PICTURE. A CALMER PLAN."
        title={
          vendor
            ? "Your business, in perspective"
            : "Your celebration, in perspective"
        }
        description="Real activity, clear numbers, and the little signals that help you decide what comes next."
      />
      {vendor && business && <MonthlyReport vendorId={business.id} />}
      {vendor && business && (
        <div className="workspace-filter">
          <Field label="Business insights">
            <select
              value={business.id}
              onChange={(e) => choose(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.businessName}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="advanced-metrics">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <Wallet size={19} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="insights-grid">
        <section className="card insights-chart">
          <div className="card-heading">
            <div>
              <h2>
                {vendor
                  ? "Six months of vendor earnings"
                  : "Where your commitments go"}
              </h2>
              <p>
                {vendor
                  ? "Captured payments less commission; refunded records are excluded."
                  : "Confirmed and completed vendor bookings, by category."}
              </p>
            </div>
            <BarChart3 size={23} />
          </div>
          {vendor ? (
            <div
              className="bar-chart"
              role="img"
              aria-label="Monthly net earnings bar chart"
            >
              {data.monthly.map((m) => (
                <div key={m.month}>
                  <strong>{taka(m.netMinor, true)}</strong>
                  <span className="bar-track">
                    <i
                      style={{
                        height: `${Math.max(2, (m.netMinor / Math.max(1, ...data.monthly.map((v) => v.netMinor))) * 100)}%`,
                      }}
                    />
                  </span>
                  <small>
                    {new Date(`${m.month}-01`).toLocaleDateString("en-GB", {
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="insights-categories">
              {data.categories.map((c) => (
                <div key={c.category}>
                  <div>
                    <strong>{c.category}</strong>
                    <span>{taka(c.committedMinor)}</span>
                  </div>
                  <div className="progress rose">
                    <span
                      style={{
                        width: `${Math.min(100, (c.committedMinor / Math.max(1, data.committedMinor)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
              {!data.categories.length && (
                <Empty title="Your commitments will tell the story" />
              )}
            </div>
          )}
        </section>
        <section className="card readiness-card">
          <div className="card-heading">
            <h2>{vendor ? "Your inquiry funnel" : "Your planning pulse"}</h2>
            <TrendingUp size={23} />
          </div>
          {vendor ? (
            <>
              <div
                className="readiness-ring"
                style={
                  {
                    "--completion": `${data.leads ? (data.won / data.leads) * 100 : 0}%`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <strong>
                    {data.leads ? Math.round((data.won / data.leads) * 100) : 0}
                    %
                  </strong>
                  <span>Win rate</span>
                </div>
              </div>
              <p>
                {data.won} won inquiries from {data.leads} total
              </p>
              <p>{data.confirmedBookings} confirmed bookings</p>
            </>
          ) : (
            <>
              <div
                className="readiness-ring"
                style={
                  {
                    "--completion": `${data.tasks.total ? (data.tasks.done / data.tasks.total) * 100 : 0}%`,
                  } as React.CSSProperties
                }
              >
                <div>
                  <strong>
                    {data.tasks.total
                      ? Math.round((data.tasks.done / data.tasks.total) * 100)
                      : 0}
                    %
                  </strong>
                  <span>Checklist complete</span>
                </div>
              </div>
              <p>{data.tasks.overdue} overdue tasks need a little attention</p>
              <div className="readiness-facts">
                <span>
                  {data.guests.attending}
                  <small>Guests attending</small>
                </span>
                <span>
                  {data.guests.seated}
                  <small>Guests seated</small>
                </span>
              </div>
            </>
          )}
        </section>
      </div>
      <section className="card section-gap">
        <div className="card-heading">
          <div>
            <h2>Your activity journal</h2>
            <p>
              Recorded changes from advanced operations and financial planning.
            </p>
          </div>
          <ActivityIcon size={22} />
        </div>
        {data.activity.map((a) => (
          <div className="activity-row" key={a.id}>
            <span className="person-avatar">{a.actorName[0]}</span>
            <div>
              <strong>{statusLabel(a.action)}</strong>
              <p>{a.detail}</p>
              <small>
                {a.actorName} ·{" "}
                {new Date(a.createdAt).toLocaleString("en-GB", {
                  timeZone: "Asia/Dhaka",
                })}
              </small>
            </div>
          </div>
        ))}
        {!data.activity.length && (
          <Empty title="Every thoughtful step will leave a trace" />
        )}
      </section>
    </>
  );
}
