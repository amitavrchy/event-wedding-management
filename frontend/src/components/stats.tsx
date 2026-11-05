"use client";
import {
  Wallet,
  Users,
  CalendarCheck2,
  ListChecks,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { useApp } from "@/lib/context";
import { taka } from "@/lib/format";
export function Stats() {
  const { event } = useApp();
  if (!event) return null;
  const accepted =
      event.guests
        ?.filter((g) => g.rsvpStatus === "ACCEPTED")
        .reduce((s, g) => s + g.partySize, 0) || 0,
    confirmed =
      event.bookings?.filter((b) =>
        ["CONFIRMED", "COMPLETED"].includes(b.status),
      ) || [],
    committed = confirmed.reduce((s, b) => s + b.priceMinor, 0),
    done = event.tasks?.filter((t) => t.done).length || 0,
    total = event.tasks?.length || 0;
  const stats = [
    {
      title: "Event budget",
      value: taka(event.budgetMinor),
      note: `${taka(committed)} committed`,
      icon: Wallet,
      color: "rose",
      href: "/budget",
      progress: event.budgetMinor
        ? Math.min(100, (committed / event.budgetMinor) * 100)
        : 0,
    },
    {
      title: "Guest responses",
      value: String(accepted).padStart(2, "0"),
      suffix: `/ ${event.guestCapacity}`,
      note: `${event.guests?.length || 0} invitations on your list`,
      icon: Users,
      color: "sage",
      href: "/guests",
      progress: event.guestCapacity
        ? Math.min(100, (accepted / event.guestCapacity) * 100)
        : 0,
    },
    {
      title: "Vendors booked",
      value: String(confirmed.length).padStart(2, "0"),
      note: "Your dream team is coming together",
      icon: CalendarCheck2,
      color: "peach",
      href: "/bookings",
    },
    {
      title: "Planning checklist",
      value: String(done).padStart(2, "0"),
      suffix: `/ ${total}`,
      note: total
        ? `${Math.round((done / total) * 100)}% of the little details, done`
        : "Let’s make a plan",
      icon: ListChecks,
      color: "lavender",
      href: "/checklist",
      progress: total ? (done / total) * 100 : 0,
    },
  ];
  return (
    <div className="stats-grid">
      {stats.map((s) => (
        <Link href={s.href} className="stat-card" key={s.title}>
          <div className="stat-top">
            <span className={`stat-icon ${s.color}`}>
              <s.icon size={20} />
            </span>
            <ArrowUpRight size={17} />
          </div>
          <p>{s.title}</p>
          <div className="stat-value">
            {s.value}
            <span>{s.suffix}</span>
          </div>
          {s.progress !== undefined && (
            <div className={`progress ${s.color}`}>
              <span style={{ width: `${s.progress}%` }} />
            </div>
          )}
          <span className="stat-note">{s.note}</span>
        </Link>
      ))}
    </div>
  );
}
