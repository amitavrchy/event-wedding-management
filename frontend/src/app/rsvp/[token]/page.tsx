"use client";
import { use, useEffect, useState } from "react";
import { Heart, CalendarDays, MapPin, Check, ArrowRight } from "lucide-react";
import { api, json } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { Day } from "@/lib/types";
import { Button, Field } from "@/components/ui";
type Invitation = {
  name: string;
  rsvpStatus: string;
  partySize: number;
  maxPartySize: number;
  mealPreference?: string;
  event: { title: string; days: Day[]; rsvpDeadline?: string };
};
export default function RSVP({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [invitation, setInvitation] = useState<Invitation | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    void api<Invitation>(`rsvp/${token}`)
      .then(setInvitation)
      .catch((e) => setError(e.message));
  }, [token]);
  return (
    <main className="rsvp-page">
      <a href="/" className="brand">
        utsab<span>✳</span>
      </a>
      <section className="rsvp-card">
        <div className="rsvp-flower">✳</div>
        <span className="eyebrow">TOGETHER WITH OUR FAMILIES</span>
        <h1>{invitation?.event.title || "You are warmly invited"}</h1>
        <p className="rsvp-intro">
          Some moments are too beautiful to celebrate without you.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {invitation ? (
          <>
            <div className="rsvp-greeting">
              <Heart size={18} />
              <h2>Dear {invitation.name},</h2>
              <p>We would love to have you by our side.</p>
            </div>
            <div className="rsvp-days">
              {invitation.event.days.map((d) => (
                <div key={d.id}>
                  <h3>{d.name}</h3>
                  <p>
                    <CalendarDays size={15} />
                    {dateLabel(d.startsAt)}
                  </p>
                  <p>
                    <MapPin size={15} />
                    {d.venueName || "Venue to be announced"}
                  </p>
                </div>
              ))}
            </div>
            {saved ? (
              <div className="rsvp-success" role="status">
                <Check size={32} />
                <h2>Your reply means the world.</h2>
                <p>Thank you for being part of our story.</p>
                <Button variant="secondary" onClick={() => setSaved(false)}>
                  Update your reply
                </Button>
              </div>
            ) : (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const f = new FormData(e.currentTarget);
                  try {
                    await api(`rsvp/${token}`, {
                      method: "POST",
                      body: json({
                        rsvpStatus: f.get("rsvpStatus"),
                        partySize: Number(f.get("partySize")),
                        mealPreference: f.get("mealPreference"),
                      }),
                    });
                    setSaved(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Will you celebrate with us?">
                  <select
                    name="rsvpStatus"
                    defaultValue={
                      invitation.rsvpStatus === "INVITED"
                        ? "ACCEPTED"
                        : invitation.rsvpStatus
                    }
                  >
                    <option value="ACCEPTED">Joyfully accept</option>
                    <option value="DECLINED">Regretfully decline</option>
                    <option value="MAYBE">Let me get back to you</option>
                  </select>
                </Field>
                <div className="form-row">
                  <Field label="Your party size">
                    <input
                      name="partySize"
                      type="number"
                      min="1"
                      max={invitation.maxPartySize}
                      defaultValue={invitation.partySize}
                      required
                    />
                  </Field>
                  <Field label="Meal preference">
                    <select
                      name="mealPreference"
                      defaultValue={invitation.mealPreference || "Regular"}
                    >
                      <option>Regular</option>
                      <option>Vegetarian</option>
                      <option>No beef</option>
                    </select>
                  </Field>
                </div>
                <Button busy={busy}>
                  Send with love <ArrowRight size={17} />
                </Button>
                {invitation.event.rsvpDeadline && (
                  <p className="helper-text">
                    Kindly reply by {dateLabel(invitation.event.rsvpDeadline)}
                  </p>
                )}
              </form>
            )}
          </>
        ) : (
          !error && <p className="muted">Opening your invitation…</p>
        )}
      </section>
      <p className="rsvp-footer">
        A beautiful celebration begins with beautiful people.
      </p>
    </main>
  );
}
