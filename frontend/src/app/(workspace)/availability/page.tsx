"use client";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Trash2,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { useBusiness } from "@/lib/use-business";
import { useAction, useResource } from "@/lib/use-resource";
import { dateLabel } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
type Resource = {
  id: string;
  title: string;
  durationHours: number;
  bufferHours: number;
  blocks: { id: string; startAt: string; endAt: string; reason?: string }[];
  bookings: {
    id: string;
    startAt: string;
    reservedUntil: string;
    status: string;
    event: { title: string };
  }[];
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function Availability() {
  const { business, businesses, choose } = useBusiness();
  const { data, reload } = useResource<Resource[]>(
    business ? `vendors/${business.id}/availability` : null,
    [],
  );
  const [resource, setResource] = useState(""),
    [month, setMonth] = useState(
      () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    [adding, setAdding] = useState(false),
    [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { busy, run } = useAction();
  const service = data.find((s) => s.id === resource) || data[0];
  if (!business)
    return <Empty title="Add a business to manage its availability" />;
  const first = new Date(month.getFullYear(), month.getMonth(), 1),
    start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      return date;
    }),
    dateKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    entries = (date: Date) => {
      const from = +new Date(`${dateKey(date)}T00:00:00+06:00`),
        until = from + 86400000;
      return [
        ...(service?.bookings || [])
          .filter(
            (b) =>
              +new Date(b.startAt) < until && +new Date(b.reservedUntil) > from,
          )
          .map((b) => ({
            id: b.id,
            title: b.event.title,
            status: b.status,
            startAt: b.startAt,
            endAt: b.reservedUntil,
            block: false,
          })),
        ...(service?.blocks || [])
          .filter(
            (b) => +new Date(b.startAt) < until && +new Date(b.endAt) > from,
          )
          .map((b) => ({
            id: b.id,
            title: b.reason || "Unavailable",
            status: "BLOCKED",
            startAt: b.startAt,
            endAt: b.endAt,
            block: true,
          })),
      ];
    };
  return (
    <>
      <PageHeading
        eyebrow="MAKE ROOM FOR YOUR BEST WORK"
        title="Your resource calendar"
        description="One resource per service or venue hall. See reservations, setup buffers, and recurring blackouts together."
        action={
          <Button disabled={!service} onClick={() => setAdding(true)}>
            <Plus size={17} />
            Block a date pattern
          </Button>
        }
      />
      <div className="calendar-filters">
        <Field label="Your business">
          <select value={business.id} onChange={(e) => choose(e.target.value)}>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bookable resource">
          <select
            value={service?.id || ""}
            onChange={(e) => setResource(e.target.value)}
          >
            {data.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {service && (
        <div className="info-note">
          <CalendarDays size={21} />
          <span>
            {service.durationHours} hour service + {service.bufferHours} hour
            setup buffer. Reservations protect the whole occupied period.
            Recurring patterns create up to 90 days of atomic, conflict-checked
            blackouts.
          </span>
        </div>
      )}
      <section className="card resource-calendar">
        <div className="calendar-heading">
          <button
            className="icon-button"
            aria-label="Previous month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft />
          </button>
          <h2>
            {month.toLocaleDateString("en-GB", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button
            className="icon-button"
            aria-label="Next month"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight />
          </button>
          <Button
            variant="ghost"
            onClick={() =>
              setMonth(
                new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              )
            }
          >
            This month
          </Button>
        </div>
        <div className="calendar-scroll">
          <div className="calendar-weekdays">
            {weekdays.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((date) => {
              const list = entries(date);
              return (
                <button
                  key={dateKey(date)}
                  className={`calendar-day ${date.getMonth() !== month.getMonth() ? "outside" : ""} ${dateKey(date) === dateKey(new Date()) ? "today" : ""}`}
                  onClick={() => setSelectedDate(date)}
                >
                  <strong>{date.getDate()}</strong>
                  {list.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={`calendar-entry ${e.block ? "blocked" : "reserved"}`}
                    >
                      {e.title}
                    </span>
                  ))}
                  {list.length > 2 && <small>+{list.length - 2} more</small>}
                </button>
              );
            })}
          </div>
        </div>
      </section>
      {selectedDate && (
        <Modal
          title={dateLabel(`${dateKey(selectedDate)}T12:00:00+06:00`)}
          onClose={() => setSelectedDate(null)}
        >
          {entries(selectedDate).map((entry) => (
            <div className="calendar-detail-row" key={entry.id}>
              <div>
                <h3>{entry.title}</h3>
                <p>
                  {new Date(entry.startAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Dhaka",
                  })}{" "}
                  –{" "}
                  {new Date(entry.endAt).toLocaleString("en-GB", {
                    timeZone: "Asia/Dhaka",
                  })}
                </p>
                <Badge value={entry.status} />
              </div>
              {entry.block && (
                <button
                  className="icon-button"
                  aria-label={`Remove block ${entry.title}`}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        `vendors/${business.id}/availability/blocks/${entry.id}`,
                        { method: "DELETE" },
                      );
                      await reload();
                    }, "Calendar block removed")
                  }
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
          {!entries(selectedDate).length && (
            <Empty title="A little room for your next booking">
              This resource has no reservations or blackout periods on this
              date.
            </Empty>
          )}
        </Modal>
      )}
      {adding && service && (
        <Modal
          title="A little time, thoughtfully protected"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(`vendors/${business.id}/availability/recurring`, {
                    method: "POST",
                    body: json({
                      serviceId: service.id,
                      from: f.get("from"),
                      until: f.get("until"),
                      fromTime: f.get("fromTime"),
                      untilTime: f.get("untilTime"),
                      weekdays: f.getAll("weekdays").map(Number),
                      reason: f.get("reason"),
                    }),
                  });
                  await reload();
                }, "Date pattern applied. Existing reservations were protected.")
              )
                setAdding(false);
            }}
          >
            <p className="muted">
              {service.title} · Select a single date or a repeating pattern, up
              to 90 days.
            </p>
            <div className="form-row">
              <Field label="From date">
                <input name="from" type="date" required />
              </Field>
              <Field label="Through date">
                <input name="until" type="date" required />
              </Field>
            </div>
            <div className="form-row">
              <Field label="Unavailable from (Asia/Dhaka)">
                <input
                  name="fromTime"
                  type="time"
                  defaultValue="09:00"
                  required
                />
              </Field>
              <Field label="Unavailable until (Asia/Dhaka)">
                <input
                  name="untilTime"
                  type="time"
                  defaultValue="18:00"
                  required
                />
              </Field>
            </div>
            <fieldset className="weekday-picker">
              <legend>Apply on these weekdays</legend>
              {weekdays.map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    name="weekdays"
                    value={i}
                    defaultChecked
                  />
                  {d}
                </label>
              ))}
            </fieldset>
            <Field label="Reason for the blackout">
              <input
                name="reason"
                required
                minLength={2}
                maxLength={200}
                placeholder="Team rest day / venue maintenance"
              />
            </Field>
            <Button busy={busy}>Protect these dates</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
