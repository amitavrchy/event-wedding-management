"use client";
import type { Day } from "@/lib/types";
import type { PublicCopy } from "@/lib/public-i18n";
import { Field } from "./ui";

export type Reply = {
  rsvpStatus: string;
  partySize: number;
  mealPreference: string;
  dietaryNotes?: string;
  dayResponses: { dayId: string; status: string }[];
};

/** Fields for one guest's reply. `prefix` keeps names unique when several are on one page. */
export function RsvpFields({
  t,
  prefix = "",
  days,
  current,
}: {
  t: PublicCopy;
  prefix?: string;
  days: Day[];
  current: {
    rsvpStatus: string;
    partySize: number;
    maxPartySize: number;
    mealPreference?: string | null;
    dietaryNotes?: string | null;
    responses?: { dayId: string; status: string }[];
  };
}) {
  return (
    <>
      <Field label={t.willYou}>
        <select
          name={`${prefix}rsvpStatus`}
          defaultValue={
            current.rsvpStatus === "INVITED" ? "ACCEPTED" : current.rsvpStatus
          }
        >
          <option value="ACCEPTED">{t.accept}</option>
          <option value="DECLINED">{t.decline}</option>
          <option value="MAYBE">{t.maybe}</option>
        </select>
      </Field>
      <div className="form-row">
        {current.maxPartySize > 1 && (
          <Field label={t.partySize}>
            <input
              name={`${prefix}partySize`}
              type="number"
              min="1"
              max={current.maxPartySize}
              defaultValue={current.partySize}
              required
            />
          </Field>
        )}
        <Field label={t.meal}>
          <select
            name={`${prefix}mealPreference`}
            defaultValue={current.mealPreference || "Regular"}
          >
            <option value="Regular">{t.regular}</option>
            <option value="Vegetarian">{t.vegetarian}</option>
            <option value="No beef">{t.noBeef}</option>
          </select>
        </Field>
      </div>
      <Field label={t.dietary}>
        <textarea
          name={`${prefix}dietaryNotes`}
          defaultValue={current.dietaryNotes || ""}
          maxLength={500}
          placeholder={t.dietaryHint}
        />
      </Field>
      {days.length > 1 && (
        <div className="day-rsvp-options">
          <h3>{t.perDay}</h3>
          {days.map((d) => (
            <Field key={d.id} label={d.name}>
              <select
                name={`${prefix}day-${d.id}`}
                defaultValue={
                  current.responses?.find((r) => r.dayId === d.id)?.status ||
                  "ACCEPTED"
                }
              >
                <option value="ACCEPTED">{t.there}</option>
                <option value="DECLINED">{t.unable}</option>
                <option value="MAYBE">{t.deciding}</option>
              </select>
            </Field>
          ))}
        </div>
      )}
    </>
  );
}

export function readReply(f: FormData, days: Day[], prefix = ""): Reply {
  return {
    rsvpStatus: String(f.get(`${prefix}rsvpStatus`)),
    partySize: Number(f.get(`${prefix}partySize`) || 1),
    mealPreference: String(f.get(`${prefix}mealPreference`) || "Regular"),
    dietaryNotes: String(f.get(`${prefix}dietaryNotes`) || "") || undefined,
    dayResponses: days.map((d) => ({
      dayId: d.id,
      status: String(f.get(`${prefix}day-${d.id}`) || "ACCEPTED"),
    })),
  };
}
