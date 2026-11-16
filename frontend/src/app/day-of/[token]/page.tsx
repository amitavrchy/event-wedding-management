"use client";
import { use, useEffect, useState } from "react";
import { CheckCircle2, Clock, MapPin } from "lucide-react";
import "@/app/tools.css";
import { api, json } from "@/lib/api";
import { Badge, Button } from "@/components/ui";

type View = {
  event: { title: string };
  vendor: { businessName: string } | null;
  days: { id: string; name: string; startsAt: string; venueName?: string }[];
  cues: {
    id: string;
    dayId: string;
    title: string;
    startsAt: string;
    durationMinutes: number;
    location?: string;
    notes?: string;
    status: string;
  }[];
  arrivedAt: string | null;
  arrivedDayId: string | null;
};
const time = (v: string) =>
  new Date(v).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Vendor's private day-of page: their cues, an arrival button and cue updates. */
export default function DayOf({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [view, setView] = useState<View | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  const load = () =>
    api<View>(`day-of/${token}`)
      .then(setView)
      .catch((e) => setError(e.message));
  useEffect(() => {
    void load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [token]);
  async function act(key: string, path: string, body: object) {
    setBusy(key);
    try {
      await api(path, { method: "POST", body: json(body) });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <main className="day-of-page">
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {view && (
        <>
          <header>
            <span className="eyebrow">{view.vendor?.businessName}</span>
            <h1>{view.event.title}</h1>
          </header>
          {view.days.map((d) => {
            const cues = view.cues.filter((c) => c.dayId === d.id);
            const arrived = view.arrivedDayId === d.id && view.arrivedAt;
            return (
              <section key={d.id} className="card padded">
                <h2>{d.name}</h2>
                <p className="muted">
                  {new Date(d.startsAt).toLocaleDateString("en-GB", {
                    timeZone: "Asia/Dhaka",
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}{" "}
                  · {time(d.startsAt)}
                  {d.venueName ? ` · ${d.venueName}` : ""}
                </p>
                {arrived ? (
                  <p className="form-success">
                    <CheckCircle2 size={16} /> Arrival recorded at{" "}
                    {time(view.arrivedAt!)}
                  </p>
                ) : (
                  <Button
                    busy={busy === `arrive-${d.id}`}
                    onClick={() =>
                      void act(`arrive-${d.id}`, `day-of/${token}/arrive`, {
                        dayId: d.id,
                      })
                    }
                  >
                    I have arrived
                  </Button>
                )}
                <ul className="cue-list">
                  {cues.map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>
                          <Clock size={14} /> {time(c.startsAt)} · {c.title}
                        </strong>
                        <small className="block muted">
                          {c.durationMinutes} min{c.location ? ` · ` : ""}
                          {c.location && (
                            <>
                              <MapPin size={12} /> {c.location}
                            </>
                          )}
                        </small>
                        {c.notes && <p>{c.notes}</p>}
                      </div>
                      <Badge
                        value={c.status === "DONE" ? "COMPLETED" : c.status}
                      />
                      {c.status !== "DONE" && (
                        <div className="button-group">
                          {c.status !== "READY" && (
                            <Button
                              variant="ghost"
                              busy={busy === `r-${c.id}`}
                              onClick={() =>
                                void act(
                                  `r-${c.id}`,
                                  `day-of/${token}/cues/${c.id}`,
                                  { status: "READY" },
                                )
                              }
                            >
                              Ready
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            busy={busy === `d-${c.id}`}
                            onClick={() =>
                              void act(
                                `d-${c.id}`,
                                `day-of/${token}/cues/${c.id}`,
                                { status: "DONE" },
                              )
                            }
                          >
                            Done
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                  {!cues.length && (
                    <li className="muted">
                      No cues assigned to you for this day.
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </>
      )}
      {!view && !error && <p className="muted">Loading…</p>}
    </main>
  );
}
