"use client";
import { useState } from "react";
import "@/app/occasion.css";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { eventType } from "@/lib/event-types";
import { CardHeading } from "./ui";

/** Lets the host add tools beyond the occasion defaults, or hide ones they do not need. */
export function ToolSettings() {
  const { event, catalog, refresh, notify } = useApp();
  const [busy, setBusy] = useState("");
  if (!event || !catalog) return null;
  const defaults = new Set(catalog.occasionDefaults[event.eventType] || []);
  const active = new Set(event.features || []);
  const readOnly = event.access === "VIEWER";
  async function toggle(key: string, on: boolean) {
    if (!event) return;
    setBusy(key);
    const enabled = new Set(event.enabledFeatures || []);
    const disabled = new Set(event.disabledFeatures || []);
    if (on) {
      disabled.delete(key);
      if (!defaults.has(key)) enabled.add(key);
    } else {
      enabled.delete(key);
      if (defaults.has(key)) disabled.add(key);
    }
    try {
      await api(`events/${event.id}`, {
        method: "PATCH",
        body: json({
          enabledFeatures: [...enabled],
          disabledFeatures: [...disabled],
        }),
      });
      await refresh();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="card">
      <CardHeading
        title="Tools for this event"
        subtitle={`Suggested for a ${eventType(event.eventType).label.toLowerCase()}. Switch on anything else you need.`}
      />
      <div className="tool-toggles padded">
        {catalog.groups.map((group) => {
          const items = catalog.features.filter(
            (f) => f.group === group.key && !f.core,
          );
          if (!items.length) return null;
          return (
            <div className="tool-toggle-group" key={group.key}>
              <h3>{group.label}</h3>
              {items.map((f) => (
                <label className="tool-toggle" key={f.key}>
                  <span>
                    <strong>{f.label}</strong>
                    {defaults.has(f.key) && (
                      <em className="muted"> · suggested</em>
                    )}
                    <small>{f.description}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={active.has(f.key)}
                    disabled={readOnly || busy === f.key}
                    onChange={(e) => void toggle(f.key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
