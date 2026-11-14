"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Send, Eye, CheckCheck } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { whatsappLink } from "@/lib/whatsapp";
import { InvitationCard, type CardData } from "@/components/invitation-card";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  PageHeading,
} from "@/components/ui";

type Template = { key: string; label: string; colors: string[] };
type Card = CardData & { id: string; version: number; dayId?: string | null };
type Data = {
  templates: Template[];
  cards: Card[];
  tracking: {
    guests: number;
    households: number;
    sent: number;
    opened: number;
    replied: number;
  };
};
type Share = {
  type: string;
  id: string;
  name: string;
  phone: string | null;
  url: string;
  text: string;
  sentAt?: string | null;
  openedAt?: string | null;
};

export default function Invitations() {
  const { event, notify } = useApp();
  const data = useResource<Data | null>(
    event ? `events/${event.id}/invitations` : null,
    null,
  );
  const [language, setLanguage] = useState<"bn" | "en">("bn");
  const share = useResource<Share[]>(
    event && event.access !== "VIEWER"
      ? `events/${event.id}/invitations/share?language=${language}`
      : null,
    [],
  );
  const card = data.data?.cards[0];
  const [draft, setDraft] = useState<CardData>({
    template: "MARIGOLD",
    language: "bn",
    headline: "",
    hostLine: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (card)
      setDraft({
        template: card.template,
        language: card.language,
        headline: card.headline,
        hostLine: card.hostLine || "",
        message: card.message,
      });
    else if (event)
      setDraft((d) => ({
        ...d,
        headline: d.headline || event.title,
        message:
          d.message ||
          "আপনাদের উপস্থিতি আমাদের আনন্দকে পূর্ণ করবে। সপরিবারে আমন্ত্রিত।",
      }));
  }, [card?.id, event?.id]);
  if (!event) return <Empty title="Create a celebration first" />;
  const readOnly = event.access === "VIEWER";
  async function save() {
    setBusy(true);
    try {
      await api(`events/${event!.id}/invitations`, {
        method: "PUT",
        body: json({ ...draft, cardId: card?.id, version: card?.version }),
      });
      await data.reload();
      notify("Invitation card saved");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  const t = data.data?.tracking;
  return (
    <>
      <PageHeading
        eyebrow="দাওয়াত কার্ড"
        title="Invitation cards"
        description="Design your card, then send each guest a personal link on WhatsApp."
      />
      {t && (
        <div className="mini-stats">
          <article>
            <Send size={22} />
            <strong>{t.sent}</strong>
            <span>Sent</span>
          </article>
          <article>
            <Eye size={22} />
            <strong>{t.opened}</strong>
            <span>Opened</span>
          </article>
          <article>
            <CheckCheck size={22} />
            <strong>{t.replied}</strong>
            <span>Replied</span>
          </article>
        </div>
      )}
      <div className="card-designer">
        <section className="card padded">
          <CardHeading title="Design" />
          <div className="form-stack">
            <Field label="Style">
              <select
                disabled={readOnly}
                value={draft.template}
                onChange={(e) =>
                  setDraft({ ...draft, template: e.target.value })
                }
              >
                {data.data?.templates.map((tpl) => (
                  <option key={tpl.key} value={tpl.key}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Language">
              <select
                disabled={readOnly}
                value={draft.language}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    language: e.target.value as CardData["language"],
                  })
                }
              >
                <option value="bn">বাংলা</option>
                <option value="en">English</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <Field label="Headline">
              <input
                disabled={readOnly}
                maxLength={120}
                value={draft.headline}
                onChange={(e) =>
                  setDraft({ ...draft, headline: e.target.value })
                }
              />
            </Field>
            <Field label="Hosts">
              <input
                disabled={readOnly}
                maxLength={200}
                value={draft.hostLine || ""}
                placeholder="মোঃ আব্দুর রহমান ও মিসেস রহমান"
                onChange={(e) =>
                  setDraft({ ...draft, hostLine: e.target.value })
                }
              />
            </Field>
            <Field label="Message">
              <textarea
                disabled={readOnly}
                rows={4}
                maxLength={1500}
                value={draft.message}
                onChange={(e) =>
                  setDraft({ ...draft, message: e.target.value })
                }
              />
            </Field>
            {!readOnly && (
              <Button busy={busy} onClick={() => void save()}>
                Save card
              </Button>
            )}
          </div>
        </section>
        <InvitationCard card={draft} days={event.days} />
      </div>
      {!readOnly && (
        <section className="card table-card">
          <CardHeading
            title="Send personal invitations"
            subtitle="Each link is private to the guest or family. Opening WhatsApp marks it as sent."
            action={
              <select
                aria-label="Message language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "bn" | "en")}
              >
                <option value="bn">বাংলা message</option>
                <option value="en">English message</option>
              </select>
            }
          />
          <div className="table-scroll">
            <table>
              <tbody>
                {share.data.map((s) => (
                  <tr key={`${s.type}-${s.id}`}>
                    <td>
                      <strong>{s.name}</strong>
                      <small className="block muted">
                        {s.type === "household" ? "Family" : "Guest"}
                      </small>
                    </td>
                    <td>
                      {s.openedAt ? "Opened" : s.sentAt ? "Sent" : "Not sent"}
                    </td>
                    <td className="align-right">
                      <a
                        className="button secondary"
                        target="_blank"
                        rel="noreferrer"
                        href={whatsappLink(s.text, s.phone)}
                        onClick={() =>
                          void api(`events/${event.id}/guests/mark-sent`, {
                            method: "POST",
                            body: json(
                              s.type === "household"
                                ? { householdIds: [s.id] }
                                : { guestIds: [s.id] },
                            ),
                          }).then(() => share.reload())
                        }
                      >
                        <MessageCircle size={16} /> WhatsApp
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!share.data.length && (
            <Empty title="Add guests to send invitations" />
          )}
        </section>
      )}
    </>
  );
}
