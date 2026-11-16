"use client";
import { useState } from "react";
import {
  Plus,
  Play,
  Check,
  Clock,
  Printer,
  MapPin,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { VendorLinks } from "@/components/vendor-links";
import { api, json } from "@/lib/api";
import { Cue } from "@/lib/advanced";
import { useAction, useResource } from "@/lib/use-resource";
import { localDateToISO, dateLabel } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
export default function RunSheet() {
  const { event } = useApp();
  const vendorPortal = Boolean(event?.features?.includes("vendorPortal"));
  const booked = Array.from(
    new Map(
      (event?.bookings || [])
        .filter(
          (b) =>
            ["CONFIRMED", "COMPLETED"].includes(b.status) && b.service?.vendor,
        )
        .map((b) => [b.vendorId, b.service.vendor!.businessName]),
    ),
  );
  const { data, reload } = useResource<Cue[]>(
    event ? `events/${event.id}/run-sheet` : null,
    [],
  );
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false),
    [day, setDay] = useState("");
  if (!event) return <Empty title="Create your event to plan every minute" />;
  const dayId = day || event.days[0]?.id,
    visible = data.filter((c) => c.dayId === dayId),
    live = visible.find((c) => c.status === "LIVE");
  async function status(cue: Cue, value: string) {
    await run(
      async () => {
        await api(`events/${event!.id}/run-sheet/${cue.id}`, {
          method: "PATCH",
          body: json({ version: cue.version, status: value }),
        });
        await reload();
      },
      value === "LIVE" ? "Your live cue has started" : "Run sheet updated",
    );
  }
  return (
    <>
      <PageHeading
        eyebrow="ALL THE LITTLE MOMENTS. RIGHT ON CUE."
        title="The celebration control room"
        description="Your minute-by-minute run of show, with clear handoffs and one live cue at a time."
        action={
          <div className="button-group">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} />
              Print run sheet
            </Button>
            <Button
              disabled={!event.days.length}
              onClick={() => setAdding(true)}
            >
              <Plus size={17} />
              Add a cue
            </Button>
          </div>
        }
      />
      {vendorPortal && event && <VendorLinks eventId={event.id} />}
      <div className="tabs">
        {event.days.map((d) => (
          <button
            key={d.id}
            className={dayId === d.id ? "selected" : ""}
            onClick={() => setDay(d.id)}
          >
            {d.name} ·{" "}
            {dateLabel(d.startsAt, { day: "numeric", month: "short" })}
          </button>
        ))}
      </div>
      {live && (
        <div className="live-banner">
          <span className="live-pulse" />
          <div>
            <span className="eyebrow">LIVE RIGHT NOW</span>
            <h2>{live.title}</h2>
            <p>
              {live.owner} · {live.durationMinutes} minutes ·{" "}
              {live.location || "Your celebration"}
            </p>
          </div>
          <Button busy={busy} onClick={() => void status(live, "DONE")}>
            <Check size={17} />
            Finish cue
          </Button>
        </div>
      )}
      <div className="run-sheet">
        {visible.map((cue, i) => (
          <article
            key={cue.id}
            className={`card cue-card cue-${cue.status.toLowerCase()}`}
          >
            <div className="cue-time">
              <strong>
                {new Date(cue.startsAt).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Dhaka",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              <span>{cue.durationMinutes} min</span>
            </div>
            <div className="cue-content">
              <div className="cue-title">
                <h2>{cue.title}</h2>
                <Badge value={cue.status} />
              </div>
              <div className="cue-meta">
                <span>{cue.owner}</span>
                {cue.location && (
                  <span>
                    <MapPin size={14} />
                    {cue.location}
                  </span>
                )}
                {visible
                  .slice(0, i)
                  .some(
                    (other) =>
                      other.owner === cue.owner &&
                      +new Date(other.startsAt) +
                        other.durationMinutes * 60000 >
                        +new Date(cue.startsAt),
                  ) && (
                  <span className="warning-text">
                    Owner overlap: review timing
                  </span>
                )}
              </div>
              {cue.notes && <p>{cue.notes}</p>}
            </div>
            <div className="cue-actions">
              {cue.status === "PLANNED" && (
                <Button
                  variant="secondary"
                  busy={busy}
                  onClick={() => void status(cue, "READY")}
                >
                  Ready
                </Button>
              )}
              {cue.status === "READY" && (
                <Button
                  disabled={Boolean(live)}
                  busy={busy}
                  onClick={() => void status(cue, "LIVE")}
                >
                  <Play size={15} />
                  Go live
                </Button>
              )}
              {cue.status === "LIVE" && (
                <Button busy={busy} onClick={() => void status(cue, "DONE")}>
                  Finish
                </Button>
              )}
              {cue.status === "DONE" && (
                <Button
                  variant="ghost"
                  busy={busy}
                  onClick={() => void status(cue, "PLANNED")}
                >
                  Reset
                </Button>
              )}
              {cue.status !== "LIVE" && (
                <button
                  className="icon-button"
                  aria-label={`Remove ${cue.title}`}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`events/${event.id}/run-sheet/${cue.id}`, {
                        method: "DELETE",
                      });
                      await reload();
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty
          title={
            event.days.length
              ? "A great day starts with a great run sheet"
              : "Add your celebration dates first"
          }
        >
          Add arrival times, ceremonies, vendor handoffs, speeches, and all the
          moments in between.
        </Empty>
      )}
      {adding && (
        <Modal
          title="Another moment, right on time"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(`events/${event.id}/run-sheet`, {
                    method: "POST",
                    body: json({
                      dayId: f.get("dayId"),
                      title: f.get("title"),
                      startsAt: localDateToISO(String(f.get("startsAt"))),
                      durationMinutes: Number(f.get("duration")),
                      owner: f.get("owner"),
                      vendorId: f.get("vendorId") || undefined,
                      location: f.get("location"),
                      notes: f.get("notes"),
                    }),
                  });
                  await reload();
                }, "Cue added")
              )
                setAdding(false);
            }}
          >
            <Field label="Celebration day">
              <select name="dayId" defaultValue={dayId}>
                {event.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cue title">
              <input
                name="title"
                required
                minLength={2}
                maxLength={150}
                placeholder="Bride & groom entrance"
              />
            </Field>
            <div className="form-row">
              <Field label="Starts at (Asia/Dhaka)">
                <input name="startsAt" type="datetime-local" required />
              </Field>
              <Field label="Duration in minutes">
                <input
                  name="duration"
                  type="number"
                  min="1"
                  max="1440"
                  defaultValue="15"
                  required
                />
              </Field>
            </div>
            <Field label="Responsible person or team">
              <input
                name="owner"
                required
                maxLength={100}
                placeholder="Photography team"
              />
            </Field>
            {vendorPortal && booked.length > 0 && (
              <Field label="Vendor (shows on their day-of page)">
                <select name="vendorId" defaultValue="">
                  <option value="">No vendor</option>
                  {booked.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Location">
              <input name="location" maxLength={150} />
            </Field>
            <Field label="Handoff notes">
              <textarea name="notes" maxLength={3000} />
            </Field>
            <Button busy={busy}>Add cue</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
