"use client";
import { useState } from "react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { Event } from "@/lib/types";
import { Button, Field, Modal } from "./ui";
export function NewEvent({ onClose }: { onClose: () => void }) {
  const { refresh, selectEvent, notify } = useApp();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const result = await api<Event>("events", {
        method: "POST",
        body: json({
          title: f.get("title"),
          eventType: f.get("eventType"),
          city: f.get("city"),
          budgetMinor: Math.round(Number(f.get("budget")) * 100),
          guestCapacity: Number(f.get("capacity")),
        }),
      });
      selectEvent(result.id);
      await refresh();
      notify("Your celebration workspace is ready");
      onClose();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="A new beginning" onClose={onClose}>
      <p className="muted">
        Start with the big picture. The beautiful details come next.
      </p>
      <form onSubmit={submit} className="form-stack">
        <Field label="Celebration name">
          <input
            name="title"
            placeholder="Ayesha & Raihan"
            required
            minLength={2}
            maxLength={150}
          />
        </Field>
        <Field label="Celebration type">
          <select name="eventType">
            <option value="WEDDING">Wedding</option>
            <option value="HOLUD">Gaye Holud</option>
            <option value="RECEPTION">Reception</option>
            <option value="CORPORATE">Corporate event</option>
          </select>
        </Field>
        <Field label="City">
          <input name="city" defaultValue="Dhaka" required />
        </Field>
        <div className="form-row">
          <Field label="Total budget (৳)">
            <input
              name="budget"
              type="number"
              min="0"
              max="20000000"
              step="1"
              defaultValue="1500000"
              required
            />
          </Field>
          <Field label="Guest capacity">
            <input
              name="capacity"
              type="number"
              min="1"
              max="10000"
              defaultValue="300"
              required
            />
          </Field>
        </div>
        <Button busy={busy}>Create celebration</Button>
      </form>
    </Modal>
  );
}
