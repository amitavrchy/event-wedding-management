"use client";
import type { Day } from "@/lib/types";

export type CardData = {
  template: string;
  language: "bn" | "en" | "both";
  headline: string;
  hostLine?: string | null;
  message: string;
};

const palette: Record<string, { bg: string; fg: string; accent: string }> = {
  MARIGOLD: { bg: "#FFF4D6", fg: "#7A2E0E", accent: "#F4A300" },
  ROYAL: { bg: "#8E1B22", fg: "#FFF6E5", accent: "#E8C27A" },
  PASTEL: { bg: "#FCEFF3", fg: "#5B4B6E", accent: "#E7A9BC" },
  MINIMAL: { bg: "#FBF7F0", fg: "#3D2F24", accent: "#C99A6B" },
  CORPORATE: { bg: "#0F3D5E", fg: "#FFFFFF", accent: "#7FB3D5" },
};

/** Printable, shareable invitation card. Used in the designer and on RSVP pages. */
export function InvitationCard({
  card,
  days = [],
}: {
  card: CardData;
  days?: Pick<Day, "id" | "name" | "startsAt" | "venueName">[];
}) {
  const colors = palette[card.template] || palette.MINIMAL;
  const locale = card.language === "en" ? "en-GB" : "bn-BD";
  return (
    <article
      className="invitation-card"
      style={{
        background: colors.bg,
        color: colors.fg,
        borderColor: colors.accent,
      }}
      lang={card.language === "en" ? "en" : "bn"}
    >
      <span className="invitation-ornament" style={{ color: colors.accent }}>
        ❁
      </span>
      {card.language !== "en" && (
        <p className="invitation-bismillah">বিসমিল্লাহির রাহমানির রাহিম</p>
      )}
      <h2>{card.headline}</h2>
      {card.hostLine && <p className="invitation-hosts">{card.hostLine}</p>}
      <p className="invitation-message">{card.message}</p>
      {days.length > 0 && (
        <ul className="invitation-days">
          {days.map((d) => (
            <li key={d.id}>
              <strong>{d.name}</strong>
              <span>
                {new Date(d.startsAt).toLocaleString(locale, {
                  timeZone: "Asia/Dhaka",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              {d.venueName && <span>{d.venueName}</span>}
            </li>
          ))}
        </ul>
      )}
      <span className="invitation-ornament" style={{ color: colors.accent }}>
        ❁
      </span>
    </article>
  );
}
