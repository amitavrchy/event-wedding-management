"use client";
import { useState } from "react";
import { Save, Plus } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  PageHeading,
} from "@/components/ui";
import { NewEvent } from "@/components/new-event";
export default function Settings() {
  const { event, user, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false),
    [adding, setAdding] = useState(false);
  return (
    <>
      <PageHeading
        eyebrow="THE DETAILS BEHIND YOUR DAY"
        title="Make it yours"
        description="A few thoughtful settings to keep your whole celebration in sync."
        action={
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <Plus size={18} />
            New celebration
          </Button>
        }
      />
      {event ? (
        <div className="settings-grid">
          <section className="card">
            <CardHeading
              title="Your celebration"
              subtitle="The big picture, all in one place."
            />
            <form
              key={event.id}
              className="form-stack padded"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await api(`events/${event.id}`, {
                    method: "PATCH",
                    body: json({
                      title: f.get("title"),
                      budgetMinor: Math.round(Number(f.get("budget")) * 100),
                      guestCapacity: Number(f.get("capacity")),
                      rsvpDeadline: f.get("deadline")
                        ? `${f.get("deadline")}T23:59:00+06:00`
                        : undefined,
                    }),
                  });
                  await refresh();
                  notify("Your celebration settings are saved");
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Celebration name">
                <input
                  name="title"
                  defaultValue={event.title}
                  minLength={2}
                  maxLength={150}
                  required
                />
              </Field>
              <Field label="Total budget (৳)">
                <input
                  type="number"
                  name="budget"
                  min="0"
                  max="20000000"
                  step="0.01"
                  defaultValue={event.budgetMinor / 100}
                  required
                />
              </Field>
              <Field label="Guest capacity">
                <input
                  type="number"
                  name="capacity"
                  min="1"
                  max="10000"
                  defaultValue={event.guestCapacity}
                  required
                />
              </Field>
              <Field label="RSVP deadline (Asia/Dhaka)">
                <input
                  type="date"
                  name="deadline"
                  defaultValue={event.rsvpDeadline?.slice(0, 10)}
                />
              </Field>
              <Button busy={busy}>
                <Save size={17} />
                Save changes
              </Button>
            </form>
          </section>
          <section className="card">
            <CardHeading
              title="Give each detail a little room"
              subtitle="Add or update a category allocation."
            />
            <form
              className="form-stack padded"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                const f = new FormData(e.currentTarget);
                try {
                  await api(
                    `events/${event.id}/budget/${encodeURIComponent(String(f.get("category")))}`,
                    {
                      method: "PUT",
                      body: json({
                        plannedMinor: Math.round(Number(f.get("amount")) * 100),
                      }),
                    },
                  );
                  await refresh();
                  notify("Category budget saved");
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Category">
                <select name="category">
                  {[
                    "Venue",
                    "Catering",
                    "Decoration",
                    "Photography",
                    "Attire",
                    "Makeup",
                    "Other",
                  ].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Planned allocation (৳)">
                <input
                  name="amount"
                  type="number"
                  min="0"
                  max="20000000"
                  step="0.01"
                  required
                />
              </Field>
              <Button busy={busy} variant="secondary">
                Save allocation
              </Button>
            </form>
            <div className="account-note">
              <strong>{user?.fullName}</strong>
              <p>
                Event ID: <code>{event.id}</code>
              </p>
              <p>
                Session: {user?.role.toLowerCase().replace("_", " ")} ·
                Asia/Dhaka
              </p>
              <p>
                Payments use a clearly marked sandbox until a live gateway is
                configured.
              </p>
            </div>
          </section>
        </div>
      ) : (
        <Empty title="Begin with a celebration">
          Create a workspace to personalize your event settings.
        </Empty>
      )}
      {adding && <NewEvent onClose={() => setAdding(false)} />}
    </>
  );
}
