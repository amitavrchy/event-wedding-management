"use client";
import { use, useEffect, useState } from "react";
import { Check, Languages, Radio, Users } from "lucide-react";
import "@/app/tools.css";
import { api, json } from "@/lib/api";
import type { Day } from "@/lib/types";
import { usePublicLocale } from "@/lib/public-i18n";
import { Button } from "@/components/ui";
import { InvitationCard, type CardData } from "@/components/invitation-card";
import { RsvpFields, readReply } from "@/components/rsvp-form";

type Family = {
  name: string;
  card: CardData | null;
  livestreamUrl: string | null;
  event: { title: string; days: Day[] } | null;
  members: {
    token: string;
    name: string;
    relationship?: string;
    rsvpStatus: string;
    partySize: number;
    maxPartySize: number;
    mealPreference?: string;
  }[];
};

export default function FamilyRSVP({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [family, setFamily] = useState<Family | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  const { locale, t, toggle } = usePublicLocale(family?.card?.language);
  useEffect(() => {
    void api<Family>(`rsvp/household/${token}`)
      .then(setFamily)
      .catch((e) => setError(e.message));
  }, [token]);
  const days =
    family?.event?.days
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
      {family?.card && <InvitationCard card={family.card} days={days} />}
      <section className="rsvp-card">
        <span className="eyebrow">{t.familyTitle}</span>
        <h1>{family?.name || family?.event?.title || t.invitedTitle}</h1>
        <p className="rsvp-intro">{t.familyIntro}</p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {family?.livestreamUrl && (
          <a
            className="button secondary livestream-link"
            href={family.livestreamUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Radio size={17} /> {t.watchLive}
          </a>
        )}
        {family &&
          (saved ? (
            <div className="rsvp-success" role="status">
              <Check size={32} />
              <h2>{t.thanks}</h2>
              <Button variant="secondary" onClick={() => setSaved(false)}>
                {t.update}
              </Button>
            </div>
          ) : (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                setError("");
                try {
                  await api(`rsvp/household/${token}`, {
                    method: "POST",
                    body: json({
                      replies: family.members.map((m, i) => {
                        const reply = readReply(f, days, `m${i}-`);
                        if (m.maxPartySize <= 1) reply.partySize = 1;
                        return { token: m.token, reply };
                      }),
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
              {family.members.map((m, i) => (
                <fieldset key={m.token} className="family-member">
                  <legend>
                    <Users size={16} /> {m.name}
                    {m.relationship ? ` · ${m.relationship}` : ""}
                  </legend>
                  <RsvpFields t={t} prefix={`m${i}-`} days={days} current={m} />
                </fieldset>
              ))}
              <Button busy={busy}>{t.sendAll}</Button>
            </form>
          ))}
        {!family && !error && <p className="muted">{t.opening}</p>}
      </section>
    </main>
  );
}
