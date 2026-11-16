"use client";
import { useState } from "react";
import { Radio } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { Button, CardHeading, Field } from "./ui";

/** Live link shown on RSVP pages and the event website for guests who cannot attend. */
export function LivestreamCard() {
  const { event, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  if (!event?.features?.includes("livestream")) return null;
  return (
    <section className="card padded" id="livestream">
      <CardHeading
        title="Livestream"
        subtitle="YouTube, Facebook Live, Zoom or Google Meet. Guests see a “Watch live” button."
      />
      <form
        className="security-row"
        onSubmit={async (e) => {
          e.preventDefault();
          const url = String(
            new FormData(e.currentTarget).get("url") || "",
          ).trim();
          setBusy(true);
          try {
            await api(`events/${event.id}/livestream`, {
              method: "PUT",
              body: json({ url: url || null }),
            });
            await refresh();
            notify(url ? "Livestream link saved" : "Livestream link removed");
          } catch (err) {
            notify((err as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Live link">
          <input
            name="url"
            type="url"
            defaultValue={event.livestreamUrl || ""}
            placeholder="https://youtube.com/live/…"
            disabled={event.access === "VIEWER"}
          />
        </Field>
        <Button busy={busy} disabled={event.access === "VIEWER"}>
          <Radio size={16} /> Save
        </Button>
      </form>
    </section>
  );
}
