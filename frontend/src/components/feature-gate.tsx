"use client";
import { useState } from "react";
import { Lock } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { eventType } from "@/lib/event-types";
import type { Feature } from "@/lib/types";
import { Button } from "./ui";

/** Shown instead of a page whose tool is not part of this event's occasion. */
export function FeatureOff({ feature }: { feature: Feature }) {
  const { event, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const canEdit = event && event.access !== "VIEWER";
  async function enable() {
    if (!event) return;
    setBusy(true);
    try {
      await api(`events/${event.id}`, {
        method: "PATCH",
        body: json({
          enabledFeatures: [
            ...new Set([...(event.enabledFeatures || []), feature.key]),
          ],
          disabledFeatures: (event.disabledFeatures || []).filter(
            (k) => k !== feature.key,
          ),
        }),
      });
      await refresh();
      notify(`${feature.label} is now part of this event`);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-off">
      <Lock size={28} />
      <h1>{feature.label} isn’t part of this event</h1>
      <p>
        {feature.description}. It is not usually needed for a{" "}
        {eventType(event?.eventType).label.toLowerCase()}, so we kept it out of
        your way.
      </p>
      {canEdit ? (
        <Button busy={busy} onClick={() => void enable()}>
          Add {feature.label} to this event
        </Button>
      ) : (
        <p className="muted">Ask the host to add this tool.</p>
      )}
    </section>
  );
}
