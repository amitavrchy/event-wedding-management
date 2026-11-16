"use client";
import { use, useEffect, useState } from "react";
import {
  Heart,
  CalendarDays,
  MapPin,
  Check,
  ArrowRight,
  Radio,
  Languages,
} from "lucide-react";
import "@/app/tools.css";
import { api, json } from "@/lib/api";
import type { Day } from "@/lib/types";
import { dateIn, usePublicLocale } from "@/lib/public-i18n";
import { Button } from "@/components/ui";
import { GuestPass } from "@/components/guest-pass";
import { InvitationCard, type CardData } from "@/components/invitation-card";
import { RsvpFields, readReply } from "@/components/rsvp-form";

type Invitation = {
  name: string;
  rsvpStatus: string;
  partySize: number;
  maxPartySize: number;
  mealPreference?: string;
  dietaryNotes?: string;
  responses?: { dayId: string; status: string }[];
  card: CardData | null;
  livestreamUrl: string | null;
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
  const { locale, t, toggle } = usePublicLocale(invitation?.card?.language);
  useEffect(() => {
    void api<Invitation>(`rsvp/${token}`)
      .then(setInvitation)
      .catch((e) => setError(e.message));
  }, [token]);
  const days =
    invitation?.event.days
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)) || [];
  return (
    <main className="rsvp-page" lang={locale}>
      <div className="rsvp-top">
        <a href="/" className="brand">
          utsab<span>✳</span>
        </a>
        <button className="link-button" onClick={toggle}>
          <Languages size={16} /> {t.language}
        </button>
      </div>
      {invitation?.card && (
        <InvitationCard card={invitation.card} days={days} />
      )}
      <section className="rsvp-card">
        {!invitation?.card && (
          <>
            <div className="rsvp-flower">✳</div>
            <span className="eyebrow">{t.together}</span>
            <h1>{invitation?.event.title || t.invitedTitle}</h1>
            <p className="rsvp-intro">{t.intro}</p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {invitation ? (
          <>
            <div className="rsvp-greeting">
              <Heart size={18} />
              <h2>
                {t.dear} {invitation.name},
              </h2>
              <p>{t.wouldLove}</p>
            </div>
            {!invitation.card && (
              <div className="rsvp-days">
                {days.map((d) => (
                  <div key={d.id}>
                    <h3>{d.name}</h3>
                    <p>
                      <CalendarDays size={15} />
                      {dateIn(locale, d.startsAt)}
                    </p>
                    <p>
                      <MapPin size={15} />
                      {d.venueName || t.venueTba}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {invitation.livestreamUrl && (
              <a
                className="button secondary livestream-link"
                href={invitation.livestreamUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Radio size={17} /> {t.watchLive}
              </a>
            )}
            {saved ? (
              <div className="rsvp-success" role="status">
                <Check size={32} />
                <h2>{t.thanks}</h2>
                <p>{t.thanksSub}</p>
                <Button variant="secondary" onClick={() => setSaved(false)}>
                  {t.update}
                </Button>
              </div>
            ) : (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  const reply = readReply(new FormData(e.currentTarget), days);
                  if (invitation.maxPartySize <= 1) reply.partySize = 1;
                  try {
                    await api(`rsvp/${token}`, {
                      method: "POST",
                      body: json(reply),
                    });
                    setInvitation({
                      ...invitation,
                      ...reply,
                      responses: reply.dayResponses,
                    });
                    setSaved(true);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <RsvpFields t={t} days={days} current={invitation} />
                <Button busy={busy}>
                  {t.send} <ArrowRight size={17} />
                </Button>
                {invitation.event.rsvpDeadline && (
                  <p className="helper-text">
                    {t.replyBy} {dateIn(locale, invitation.event.rsvpDeadline)}
                  </p>
                )}
              </form>
            )}
            {saved && invitation.rsvpStatus === "ACCEPTED" && (
              <GuestPass token={token} name={invitation.name} />
            )}
          </>
        ) : (
          !error && <p className="muted">{t.opening}</p>
        )}
      </section>
    </main>
  );
}
