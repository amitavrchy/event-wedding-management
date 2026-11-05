"use client";
import { useState } from "react";
import { Plus, MapPin, CalendarDays, Clock } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { dateLabel, localDateToISO } from "@/lib/format";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
export default function Timeline() {
  const { event, refresh, notify } = useApp();
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false);
  if (!event) return <Empty title="Create a celebration to set your dates" />;
  return (
    <>
      <PageHeading
        eyebrow="EVERY CHAPTER OF YOUR CELEBRATION"
        title="The moments that make your story"
        description="From the first splash of holud to the last dance. Every day, together."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add a celebration day
          </Button>
        }
      />
      <div className="timeline">
        {event.days
          ?.slice()
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
          .map((day, i) => (
            <article className="timeline-item" key={day.id}>
              <span className="timeline-dot">{i + 1}</span>
              <div className="card timeline-card">
                <span className="eyebrow">
                  CHAPTER {String(i + 1).padStart(2, "0")}
                </span>
                <h2>{day.name}</h2>
                <div className="timeline-meta">
                  <span>
                    <CalendarDays size={18} />
                    {dateLabel(day.startsAt)}
                  </span>
                  <span>
                    <Clock size={18} />
                    {new Date(day.startsAt).toLocaleTimeString("en-GB", {
                      timeZone: "Asia/Dhaka",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    –{" "}
                    {new Date(day.endsAt).toLocaleTimeString("en-GB", {
                      timeZone: "Asia/Dhaka",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    <MapPin size={18} />
                    {day.venueName || "Venue to be decided"}
                  </span>
                </div>
              </div>
            </article>
          ))}
      </div>
      {!event.days?.length && (
        <Empty title="Your story is waiting for its dates">
          Add a holud, wedding, reception, or any day worth celebrating.
        </Empty>
      )}
      {adding && (
        <Modal title="Another day to remember" onClose={() => setAdding(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api(`events/${event.id}/days`, {
                  method: "POST",
                  body: json({
                    name: f.get("name"),
                    venueName: f.get("venueName"),
                    startsAt: localDateToISO(String(f.get("startsAt"))),
                    endsAt: localDateToISO(String(f.get("endsAt"))),
                  }),
                });
                await refresh();
                setAdding(false);
                notify("A new chapter added");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Celebration name">
              <input
                name="name"
                required
                minLength={2}
                maxLength={100}
                placeholder="Gaye Holud"
              />
            </Field>
            <Field label="Starts at (Asia/Dhaka)">
              <input type="datetime-local" name="startsAt" required />
            </Field>
            <Field label="Ends at (Asia/Dhaka)">
              <input type="datetime-local" name="endsAt" required />
            </Field>
            <Field label="Venue name">
              <input name="venueName" maxLength={150} />
            </Field>
            <Button busy={busy}>Add celebration day</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
