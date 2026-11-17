"use client";
import Link from "next/link";
import { useState } from "react";
import {
  BadgeCheck,
  Clock,
  MessageSquareText,
  CalendarCheck,
  Star,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { taka } from "@/lib/format";
import type { Vendor } from "@/lib/types";
import { Button, Field, Modal } from "./ui";
import { BookingModal } from "./booking-modal";

/** Vendor summary with the two next steps: send an inquiry, or check a date and book. */
export function VendorSheet({
  vendor,
  onClose,
}: {
  vendor: Vendor;
  onClose: () => void;
}) {
  const { event, notify } = useApp();
  const [mode, setMode] = useState<"view" | "inquiry" | "book">("view");
  const [busy, setBusy] = useState(false);
  if (mode === "book")
    return <BookingModal vendor={vendor} onClose={onClose} />;
  const firstDay = event?.days
    ?.slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return (
    <Modal title={vendor.businessName} onClose={onClose}>
      {mode === "view" ? (
        <div className="form-stack">
          <div className="vendor-badges">
            {vendor.verified && (
              <span className="badge badge-verified">
                <BadgeCheck size={14} /> Verified
              </span>
            )}
            {vendor.sponsored && (
              <span className="badge badge-sponsored">Sponsored</span>
            )}
            {vendor.ratingCount ? (
              <span className="badge">
                <Star size={14} /> {vendor.ratingAvg?.toFixed(1)} ·{" "}
                {vendor.ratingCount} reviews
              </span>
            ) : null}
            {vendor.responseMinutes != null && (
              <span className="badge">
                <Clock size={14} /> Usually replies in{" "}
                {vendor.responseMinutes < 60
                  ? `${vendor.responseMinutes} min`
                  : `${Math.round(vendor.responseMinutes / 60)} h`}
              </span>
            )}
          </div>
          <p>{vendor.description}</p>
          {vendor.serviceAreas?.length ? (
            <p className="muted">Serves {vendor.serviceAreas.join(", ")}</p>
          ) : null}
          <ul className="meal-list">
            {vendor.services.map((s) => (
              <li key={s.id}>
                <span>
                  {s.title}
                  {s.capacity ? ` · up to ${s.capacity} guests` : ""}
                </span>
                <strong>{taka(s.basePriceMinor)}</strong>
              </li>
            ))}
          </ul>
          <div className="button-group">
            <Button onClick={() => setMode("inquiry")}>
              <MessageSquareText size={17} /> Send an inquiry
            </Button>
            <Button variant="secondary" onClick={() => setMode("book")}>
              <CalendarCheck size={17} /> Check a date
            </Button>
            <Link
              className="text-link"
              href={`/v/${vendor.slug}`}
              target="_blank"
            >
              Full profile ↗
            </Link>
          </div>
        </div>
      ) : (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setBusy(true);
            try {
              await api(`vendors/${vendor.id}/inquiries`, {
                method: "POST",
                body: json({
                  eventId: event?.access !== "VIEWER" ? event?.id : undefined,
                  serviceId: f.get("serviceId") || undefined,
                  eventDate: f.get("date")
                    ? `${f.get("date")}T18:00:00+06:00`
                    : undefined,
                  guestCount: f.get("guests")
                    ? Number(f.get("guests"))
                    : undefined,
                  budgetMinor: f.get("budget")
                    ? Math.round(Number(f.get("budget")) * 100)
                    : undefined,
                  phone: f.get("phone") || undefined,
                  message: f.get("message"),
                }),
              });
              notify(
                `Inquiry sent to ${vendor.businessName}. You'll be notified when they reply.`,
              );
              onClose();
            } catch (e) {
              notify((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Service">
            <select name="serviceId" defaultValue="">
              <option value="">Not sure yet</option>
              {vendor.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-row">
            <Field label="Event date">
              <input
                name="date"
                type="date"
                defaultValue={firstDay?.startsAt.slice(0, 10)}
              />
            </Field>
            <Field label="Guests">
              <input
                name="guests"
                type="number"
                min="1"
                defaultValue={event?.guestCapacity}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label="Budget for this (৳)">
              <input name="budget" type="number" min="0" />
            </Field>
            <Field label="Your phone (shared with this vendor)">
              <input name="phone" type="tel" placeholder="01XXXXXXXXX" />
            </Field>
          </div>
          <Field label="Message">
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder="Tell them about your event and what you need."
            />
          </Field>
          <div className="button-group">
            <Button busy={busy}>Send inquiry</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("view")}
            >
              Back
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
