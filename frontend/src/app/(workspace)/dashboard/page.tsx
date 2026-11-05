"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Plus,
  Sparkles,
  Heart,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { dateLabel, daysUntil } from "@/lib/format";
import { Vendor } from "@/lib/types";
import { Stats } from "@/components/stats";
import { NewEvent } from "@/components/new-event";
import { eventType } from "@/lib/event-types";
import { VendorCard } from "@/components/vendor-card";
import { BookingModal } from "@/components/booking-modal";
import { Button, CardHeading, Empty, PageHeading } from "@/components/ui";
export default function Dashboard() {
  const { event, user, vendors, refresh, notify, loading } = useApp();
  const [creating, setCreating] = useState(false),
    [vendor, setVendor] = useState<Vendor | null>(null);
  const [initialType, setInitialType] = useState("GENERAL");
  const occasion = eventType(event?.eventType);
  useEffect(() => {
    const query = new URLSearchParams(location.search),
      intent = query.get("new") || sessionStorage.getItem("utsab-event-intent");
    if (intent) {
      setInitialType(eventType(intent).type);
      setCreating(true);
      sessionStorage.removeItem("utsab-event-intent");
      if (query.has("new")) {
        query.delete("new");
        history.replaceState(
          null,
          "",
          `${location.pathname}${query.size ? `?${query}` : ""}${location.hash}`,
        );
      }
    }
  }, []);
  const next = event?.days
    ?.slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .find((d) => +new Date(d.startsAt) > Date.now());
  async function toggle(id: string, done: boolean) {
    try {
      await api(`events/${event!.id}/tasks/${id}`, {
        method: "PATCH",
        body: json({ done: !done }),
      });
      await refresh();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="LET’S MAKE SOMETHING BEAUTIFUL"
        title={`Hello, ${user?.fullName.split(" ")[0] || "there"} ☀`}
        description="A little planning today. A lifetime of beautiful memories."
        action={
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus size={18} />
            New celebration
          </Button>
        }
      />
      <Link
        href={user?.role === "VENDOR" ? "/business" : "/planning"}
        className="advanced-entry"
      >
        <div>
          <span className="eyebrow">YOUR NEXT LEVEL OF PLANNING</span>
          <strong>
            {user?.role === "VENDOR"
              ? "Open your business suite"
              : "Step into your planning studio"}
          </strong>
          <p>
            {user?.role === "VENDOR"
              ? "Client pipeline, agreements, resource calendars, and business insights."
              : "Floor plans, live cues, guest passes, your website, and a whole lot more."}
          </p>
        </div>
        <ArrowUpRight size={25} />
      </Link>
      {event ? (
        <>
          <section
            className="celebration-hero"
            style={{
              backgroundImage: `linear-gradient(90deg,#322c26e8 0%,#332a26bd 40%,#393b3155 75%),url("${occasion.image}")`,
            }}
          >
            <div className="hero-text">
              <span className="hero-tag">
                <span />
                {occasion.tagline}
              </span>
              <h2>{event.title}</h2>
              <p>{occasion.description}</p>
              <div className="hero-meta">
                <span>
                  <CalendarDays size={17} />
                  {next ? dateLabel(next.startsAt) : "Your dates, your story"}
                </span>
                <span>
                  <MapPin size={17} />
                  {event.city}, Bangladesh
                </span>
              </div>
              <Link className="hero-link" href="/timeline">
                View celebration timeline <ArrowRight size={17} />
              </Link>
            </div>
            <div className="countdown">
              <Heart size={19} />
              <strong>{next ? daysUntil(next.startsAt) : "∞"}</strong>
              <span>{next ? "DAYS TO YOUR MOMENT" : "POSSIBILITIES"}</span>
              <div className="countdown-rule" />
              <small>And a lifetime to go.</small>
            </div>
          </section>
          <Stats />
          <div className="dashboard-columns">
            <section className="card">
              <CardHeading
                title="A little closer to your big day"
                subtitle="Small steps. Big, beautiful progress."
                action={
                  <Link className="text-link" href="/checklist">
                    View all <ArrowUpRight size={17} />
                  </Link>
                }
              />
              <div className="task-list">
                {event.tasks?.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    className={`task-row ${t.done ? "done" : ""}`}
                    onClick={() => void toggle(t.id, t.done)}
                  >
                    <span className="task-check">
                      {t.done && <Check size={14} />}
                    </span>
                    <span className="task-copy">
                      <strong>{t.title}</strong>
                      <small>
                        {t.done
                          ? "One less thing to think about"
                          : t.dueAt
                            ? `By ${dateLabel(t.dueAt, { day: "numeric", month: "short" })}`
                            : "Whenever you’re ready"}
                      </small>
                    </span>
                    <span className={`task-status ${t.done ? "finished" : ""}`}>
                      {t.done ? "Done" : "To do"}
                    </span>
                  </button>
                ))}
                {!event.tasks?.length && (
                  <Empty title="A fresh page for your plans">
                    <Link href="/checklist">Add your first task</Link>
                  </Empty>
                )}
              </div>
              <div className="card-bottom-note">
                <Sparkles size={16} />
                You’re doing great. One lovely detail at a time.
              </div>
            </section>
            <section className="card upcoming-card">
              <CardHeading
                title="Moments on the horizon"
                subtitle="Your celebrations, all in one place."
                action={
                  <Link className="text-link" href="/timeline">
                    <ArrowUpRight size={18} />
                  </Link>
                }
              />
              <div className="day-list">
                {event.days
                  ?.slice()
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((d, i) => (
                    <Link href="/timeline" className="day-row" key={d.id}>
                      <div className={`date-block day-${i % 3}`}>
                        <span>{dateLabel(d.startsAt, { month: "short" })}</span>
                        <strong>
                          {dateLabel(d.startsAt, { day: "2-digit" })}
                        </strong>
                      </div>
                      <div>
                        <h3>{d.name}</h3>
                        <p>
                          <MapPin size={13} />
                          {d.venueName || "A beautiful place to be decided"}
                        </p>
                      </div>
                      <ArrowUpRight size={16} />
                    </Link>
                  ))}
                {!event.days?.length && (
                  <Empty title="Every moment has its day">
                    <Link href="/timeline">Add your celebration dates</Link>
                  </Empty>
                )}
              </div>
            </section>
          </div>
          <section className="vendors-section">
            <CardHeading
              title="Your people. Your perfect team."
              subtitle="Discover professionals who care about your day as much as you do."
              action={
                <Link className="text-link" href="/vendors">
                  Explore vendors <ArrowRight size={17} />
                </Link>
              }
            />
            <div className="vendor-grid compact">
              {vendors.slice(0, 3).map((v) => (
                <VendorCard key={v.id} vendor={v} onSelect={setVendor} />
              ))}
            </div>
          </section>
          <section className="inspiration-strip">
            <span className="inspiration-icon">✳</span>
            <div>
              <span className="eyebrow">A FRIENDLY REMINDER</span>
              <h3>The best part of every celebration is the people.</h3>
              <p>We’ll help you take care of the rest.</p>
            </div>
            <Link href="/packages">
              Find your perfect package <ArrowUpRight size={18} />
            </Link>
          </section>
        </>
      ) : loading ? (
        <div className="skeleton-grid" aria-label="Loading your celebration">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton" />
          ))}
        </div>
      ) : (
        <div className="welcome-empty">
          <Sparkles size={44} />
          <h2>Every great celebration starts with a little spark.</h2>
          <p>
            Create your event, gather your people, and make something
            unforgettable.
          </p>
          <Button onClick={() => setCreating(true)}>
            Plan your first celebration <ArrowRight size={18} />
          </Button>
        </div>
      )}
      {creating && (
        <NewEvent
          initialType={initialType}
          onClose={() => setCreating(false)}
        />
      )}{" "}
      {vendor && (
        <BookingModal vendor={vendor} onClose={() => setVendor(null)} />
      )}
    </>
  );
}
