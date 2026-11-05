"use client";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, ShieldCheck, Heart } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { localDateToISO, taka } from "@/lib/format";
import { Vendor } from "@/lib/types";
import { Button, Empty, Field, Modal } from "./ui";
export function BookingModal({
  vendor,
  onClose,
}: {
  vendor: Vendor;
  onClose: () => void;
}) {
  const { event, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false),
    [calendar, setCalendar] = useState<
      {
        id: string;
        title: string;
        blocks: { startAt: string; endAt: string }[];
        bookings: { startAt: string; reservedUntil: string }[];
      }[]
    >([]),
    [reviews, setReviews] = useState<
      { id: string; rating: number; body: string }[]
    >([]);
  useEffect(() => {
    void api<typeof calendar>(`vendors/${vendor.id}/calendar`)
      .then(setCalendar)
      .catch((e) => notify(e.message, true));
    void api<typeof reviews>(`vendors/${vendor.id}/reviews`)
      .then(setReviews)
      .catch(() => {});
  }, [vendor.id, notify]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await api("bookings", {
        method: "POST",
        body: json({
          eventId: event.id,
          serviceId: f.get("serviceId"),
          startAt: localDateToISO(String(f.get("startAt"))),
          policyFlags: f.get("rain") ? ["RAIN_DATE"] : [],
        }),
      });
      await refresh();
      notify("Date held for 15 minutes. Pay the advance in My bookings.");
      onClose();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={vendor.businessName} onClose={onClose}>
      <div
        className="detail-image"
        style={{ backgroundImage: `url("${vendor.image}")` }}
      />
      <span className="detail-meta">
        <MapPin size={16} />
        {vendor.city} · {vendor.category}
      </span>
      <p className="detail-description">{vendor.description}</p>
      <Button
        variant="secondary"
        onClick={async () => {
          try {
            await api(`favorites/${vendor.id}`, { method: "POST" });
            notify("Saved to your dream-team shortlist");
          } catch (e) {
            notify((e as Error).message, true);
          }
        }}
      >
        <Heart size={17} />
        Save to shortlist
      </Button>
      <div className="info-note">
        <ShieldCheck size={20} />
        <span>
          A 30% advance confirms your booking. Dates include service setup
          buffers.
        </span>
      </div>
      {event && vendor.services.length ? (
        <form className="form-stack" onSubmit={submit}>
          <Field label="Choose a service">
            <select name="serviceId">
              {vendor.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {taka(s.basePriceMinor)} · {s.durationHours}h
                </option>
              ))}
            </select>
          </Field>
          <Field label="Celebration date & time (Asia/Dhaka)">
            <input
              name="startAt"
              type="datetime-local"
              min={new Date().toISOString().slice(0, 16)}
              required
            />
          </Field>
          <label className="check-field">
            <input type="checkbox" name="rain" />
            Request rain-date consideration
          </label>
          <Button busy={busy}>
            <CalendarDays size={18} />
            Hold this date
          </Button>
        </form>
      ) : (
        <Empty title="Create your event first">
          Your event workspace keeps every booking together.
        </Empty>
      )}
      <details className="calendar-details">
        <summary>Reserved dates & calendar blocks</summary>
        {calendar.flatMap((s) => [
          ...s.bookings.map((b, i) => (
            <p key={`${s.id}-b-${i}`}>
              {s.title}:{" "}
              {new Date(b.startAt).toLocaleString("en-GB", {
                timeZone: "Asia/Dhaka",
              })}
            </p>
          )),
          ...s.blocks.map((b, i) => (
            <p key={`${s.id}-a-${i}`}>
              {s.title}: unavailable{" "}
              {new Date(b.startAt).toLocaleDateString("en-GB", {
                timeZone: "Asia/Dhaka",
              })}
            </p>
          )),
        ]).length ? (
          calendar.flatMap((s) =>
            [...s.bookings, ...s.blocks].map((b, i) => (
              <p key={`${s.id}-${i}`}>
                {s.title} ·{" "}
                {new Date(b.startAt).toLocaleDateString("en-GB", {
                  timeZone: "Asia/Dhaka",
                })}
              </p>
            )),
          )
        ) : (
          <p>No reserved dates currently listed.</p>
        )}
      </details>
      <details className="calendar-details">
        <summary>Verified reviews ({reviews.length})</summary>
        {reviews.length ? (
          reviews.map((r) => (
            <p key={r.id}>
              {"★".repeat(r.rating)} · {r.body}
            </p>
          ))
        ) : (
          <p>Be part of their next beautiful story. No reviews yet.</p>
        )}
      </details>
    </Modal>
  );
}
