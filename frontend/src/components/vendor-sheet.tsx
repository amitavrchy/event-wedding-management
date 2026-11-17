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
import { usePublicLocale } from "@/lib/public-i18n";
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
  const { locale } = usePublicLocale();
  const bn = locale === "bn";
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
                <BadgeCheck size={14} /> {bn ? "যাচাইকৃত" : "Verified"}
              </span>
            )}
            {vendor.sponsored && (
              <span className="badge badge-sponsored">
                {bn ? "স্পন্সর করা" : "Sponsored"}
              </span>
            )}
            {vendor.ratingCount ? (
              <span className="badge">
                <Star size={14} /> {vendor.ratingAvg?.toFixed(1)} ·{" "}
                {vendor.ratingCount} {bn ? "রিভিউ" : "reviews"}
              </span>
            ) : null}
            {vendor.responseMinutes != null && (
              <span className="badge">
                <Clock size={14} />{" "}
                {bn ? "সাধারণত উত্তর দেন" : "Usually replies in"}{" "}
                {vendor.responseMinutes < 60
                  ? `${vendor.responseMinutes} ${bn ? "মিনিটে" : "min"}`
                  : `${Math.round(vendor.responseMinutes / 60)} ${bn ? "ঘণ্টায়" : "h"}`}
              </span>
            )}
          </div>
          <p>{vendor.description}</p>
          {vendor.serviceAreas?.length ? (
            <p className="muted">
              {bn ? "সেবার এলাকা" : "Serves"} {vendor.serviceAreas.join(", ")}
            </p>
          ) : null}
          <ul className="meal-list">
            {vendor.services.map((s) => (
              <li key={s.id}>
                <span>
                  {s.title}
                  {s.capacity
                    ? ` · ${bn ? "সর্বোচ্চ" : "up to"} ${s.capacity} ${bn ? "অতিথি" : "guests"}`
                    : ""}
                </span>
                <strong>{taka(s.basePriceMinor)}</strong>
              </li>
            ))}
          </ul>
          <div className="button-group">
            <Button onClick={() => setMode("inquiry")}>
              <MessageSquareText size={17} />{" "}
              {bn ? "অনুসন্ধান পাঠান" : "Send an inquiry"}
            </Button>
            <Button variant="secondary" onClick={() => setMode("book")}>
              <CalendarCheck size={17} /> {bn ? "তারিখ দেখুন" : "Check a date"}
            </Button>
            <Link
              className="text-link"
              href={`/v/${vendor.slug}`}
              target="_blank"
            >
              {bn ? "সম্পূর্ণ প্রোফাইল ↗" : "Full profile ↗"}
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
                bn
                  ? `${vendor.businessName} বরাবর অনুসন্ধান পাঠানো হয়েছে। উত্তর পেলে আপনাকে জানানো হবে।`
                  : `Inquiry sent to ${vendor.businessName}. You'll be notified when they reply.`,
              );
              onClose();
            } catch (e) {
              notify((e as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label={bn ? "সেবা" : "Service"}>
            <select name="serviceId" defaultValue="">
              <option value="">{bn ? "এখনও ঠিক করিনি" : "Not sure yet"}</option>
              {vendor.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-row">
            <Field label={bn ? "অনুষ্ঠানের তারিখ" : "Event date"}>
              <input
                name="date"
                type="date"
                defaultValue={firstDay?.startsAt.slice(0, 10)}
              />
            </Field>
            <Field label={bn ? "অতিথি" : "Guests"}>
              <input
                name="guests"
                type="number"
                min="1"
                defaultValue={event?.guestCapacity}
              />
            </Field>
          </div>
          <div className="form-row">
            <Field label={bn ? "এর জন্য বাজেট (৳)" : "Budget for this (৳)"}>
              <input name="budget" type="number" min="0" />
            </Field>
            <Field
              label={
                bn
                  ? "আপনার ফোন (এই বিক্রেতাকে জানানো হবে)"
                  : "Your phone (shared with this vendor)"
              }
            >
              <input name="phone" type="tel" placeholder="01XXXXXXXXX" />
            </Field>
          </div>
          <Field label={bn ? "বার্তা" : "Message"}>
            <textarea
              name="message"
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              placeholder={
                bn
                  ? "আপনার অনুষ্ঠান ও প্রয়োজন সম্পর্কে জানান।"
                  : "Tell them about your event and what you need."
              }
            />
          </Field>
          <div className="button-group">
            <Button busy={busy}>
              {bn ? "অনুসন্ধান পাঠান" : "Send inquiry"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("view")}
            >
              {bn ? "ফিরে যান" : "Back"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
