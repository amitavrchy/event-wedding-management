"use client";
import Link from "next/link";
import { useState } from "react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { useResource } from "@/lib/use-resource";
import { Empty, Field, PageHeading } from "@/components/ui";

type Day = {
  date: string;
  weekday: number;
  isWeekend: boolean;
  holidays: {
    name: string;
    nameBn: string;
    kind: string;
    estimated: boolean;
  }[];
  ramadan: boolean;
  vendors: { vendorId: string; name: string; free: boolean }[];
  freeVendors: number;
};
type Planner = { days: Day[]; shortlistSize: number; note: string };
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const iso = (d: Date) => new Date(+d + 6 * 3600000).toISOString().slice(0, 10);

export default function DatePlanner() {
  const { event } = useApp();
  const [from, setFrom] = useState(iso(new Date(Date.now() + 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date(Date.now() + 120 * 86400000)));
  const [time, setTime] = useState("18:00");
  const data = useResource<Planner | null>(
    event
      ? `events/${event.id}/date-planner?from=${from}&to=${to}&time=${time}`
      : null,
    null,
  );
  if (!event) return <Empty title="Create a celebration first" />;
  return (
    <>
      <PageHeading
        eyebrow="তারিখ পরিকল্পনা"
        title="Date planner"
        description="Find a date that avoids holidays and Ramadan and suits the vendors you like."
      />
      <div className="filter-bar">
        <Field label="From">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="To">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Start time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
      </div>
      {data.data && (
        <>
          {data.data.shortlistSize === 0 && (
            <div className="info-note">
              Add vendors to your <Link href="/shortlist">shortlist</Link> to
              see who is free on each date.
            </div>
          )}
          <div className="date-grid" role="list">
            {data.data.days.map((d) => {
              const blocked =
                d.ramadan ||
                d.holidays.some((h) => h.kind !== "NATIONAL" || !h.estimated);
              return (
                <article
                  key={d.date}
                  role="listitem"
                  className={`date-cell ${d.ramadan ? "ramadan" : ""} ${d.holidays.length ? "holiday" : ""} ${d.isWeekend ? "weekend" : ""} ${!blocked && d.vendors.length && d.freeVendors === d.vendors.length ? "great" : ""}`}
                >
                  <header>
                    <strong>{Number(d.date.slice(8))}</strong>
                    <span>
                      {WEEKDAY[d.weekday]} ·{" "}
                      {new Date(`${d.date}T12:00:00Z`).toLocaleDateString(
                        "en-GB",
                        { month: "short" },
                      )}
                    </span>
                  </header>
                  {d.holidays.map((h) => (
                    <small key={h.name} className="date-tag">
                      {h.nameBn}
                      {h.estimated ? " (est.)" : ""}
                    </small>
                  ))}
                  {d.ramadan && !d.holidays.length && (
                    <small className="date-tag">রমজান</small>
                  )}
                  {d.vendors.length > 0 && (
                    <small
                      className="date-vendors"
                      title={d.vendors
                        .map((v) => `${v.name}: ${v.free ? "free" : "booked"}`)
                        .join("\n")}
                    >
                      {d.freeVendors}/{d.vendors.length} vendors free
                    </small>
                  )}
                </article>
              );
            })}
          </div>
          <p className="helper-text">{data.data.note}</p>
        </>
      )}
    </>
  );
}
