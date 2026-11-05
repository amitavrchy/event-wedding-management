"use client";
import { useState } from "react";
import { Sparkles, CalendarDays } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { Event } from "@/lib/types";
import { eventTypes, eventType } from "@/lib/event-types";
import { Button, Field, Modal } from "./ui";
export function NewEvent({
  onClose,
  initialType = "GENERAL",
}: {
  onClose: () => void;
  initialType?: string;
}) {
  const { refresh, selectEvent, notify } = useApp();
  const [busy, setBusy] = useState(false),
    [type, setType] = useState(eventType(initialType).type),
    [budget, setBudget] = useState(String(eventType(initialType).budget)),
    [capacity, setCapacity] = useState(String(eventType(initialType).guests));
  const occasion = eventType(type);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<Event>("events", {
        method: "POST",
        body: json({
          title: f.get("title"),
          eventType: type,
          city: f.get("city"),
          budgetMinor: Math.round(Number(budget) * 100),
          guestCapacity: Number(capacity),
          starterPlan: f.get("starterPlan") === "on",
          startsAt: f.get("date")
            ? `${f.get("date")}T${f.get("time") || "18:00"}:00+06:00`
            : undefined,
          durationHours: Number(f.get("duration") || occasion.hours),
        }),
      });
      selectEvent(result.id);
      await refresh();
      notify(`Your ${occasion.label.toLowerCase()} workspace is ready`);
      onClose();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Every good gathering starts here" onClose={onClose}>
      <p className="muted">
        Choose your occasion. We’ll give you a thoughtful starting point to make
        your own.
      </p>
      <form onSubmit={submit} className="form-stack">
        <Field label="Occasion type">
          <select
            name="eventType"
            value={type}
            onChange={(e) => {
              const selected = eventType(e.target.value);
              setType(selected.type);
              setBudget(String(selected.budget));
              setCapacity(String(selected.guests));
            }}
          >
            {eventTypes.map((t) => (
              <option key={t.type} value={t.type}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="occasion-plan-note">
          <Sparkles size={20} />
          <p>
            {occasion.description}
            <span>Budget and guest defaults are editable starting points.</span>
          </p>
        </div>
        <Field label="Event name">
          <input
            name="title"
            placeholder={occasion.placeholder}
            required
            minLength={2}
            maxLength={150}
          />
        </Field>
        <Field label="City">
          <input name="city" defaultValue="Dhaka" required maxLength={100} />
        </Field>
        <div className="form-row">
          <Field label="Total budget (৳)">
            <input
              name="budget"
              type="number"
              min="0"
              max="20000000"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              required
            />
          </Field>
          <Field label="Guest capacity">
            <input
              name="capacity"
              type="number"
              min="1"
              max="10000"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              required
            />
          </Field>
        </div>
        <details className="event-date-details">
          <summary>
            <CalendarDays size={17} />
            Already have a date? Add your event schedule
          </summary>
          <div className="form-row">
            <Field label="Event date (optional)">
              <input name="date" type="date" />
            </Field>
            <Field label="Start time (Asia/Dhaka)">
              <input name="time" type="time" defaultValue="18:00" />
            </Field>
          </div>
          <Field label="Event duration in hours">
            <input
              key={type}
              name="duration"
              type="number"
              min="1"
              max="72"
              defaultValue={occasion.hours}
            />
          </Field>
        </details>
        <label className="check-field">
          <input type="checkbox" name="starterPlan" defaultChecked />
          <span>
            Add an occasion-specific starter checklist and budget categories
          </span>
        </label>
        <Button busy={busy}>Create event workspace</Button>
      </form>
    </Modal>
  );
}
