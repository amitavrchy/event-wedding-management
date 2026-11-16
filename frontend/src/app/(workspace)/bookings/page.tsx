"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, CreditCard, Plus, Star, X } from "lucide-react";
import { useApp } from "@/lib/context";
import { useResource } from "@/lib/use-resource";
import { api, json } from "@/lib/api";
import { dateLabel, taka } from "@/lib/format";
import { Booking } from "@/lib/types";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
export default function Bookings() {
  const { event, user, refresh, notify } = useApp();
  const health = useResource<{ paymentMode?: string } | null>("health", null);
  const sandbox = health.data?.paymentMode === "sandbox";
  async function vendorAction(b: Booking, action: "confirm" | "payment") {
    try {
      if (action === "confirm")
        await api(`bookings/${b.id}/confirm`, { method: "POST", body: "{}" });
      else {
        const amount = window.prompt("Amount received (৳)");
        if (!amount) return;
        const method = (
          window.prompt(
            "Paid by: CASH, BKASH, NAGAD, ROCKET, BANK or OTHER",
            "BKASH",
          ) || ""
        ).toUpperCase();
        await api(`bookings/${b.id}/offline-payments`, {
          method: "POST",
          body: json({
            amountMinor: Math.round(Number(amount) * 100),
            method,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
      }
      await load();
      notify(
        action === "confirm"
          ? "Booking confirmed. The family has been notified."
          : "Payment recorded",
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  const [items, setItems] = useState<Booking[]>([]),
    [busy, setBusy] = useState(""),
    [review, setReview] = useState<Booking | null>(null),
    [cancel, setCancel] = useState<Booking | null>(null);
  const [reason, setReason] = useState("");
  async function load() {
    try {
      setItems(await api<Booking[]>("bookings"));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    void load();
  }, [event?.id]);
  async function pay(b: Booking, kind: "ADVANCE" | "BALANCE") {
    setBusy(b.id);
    try {
      const payment = await api<{ id: string }>("payments", {
        method: "POST",
        body: json({
          bookingId: b.id,
          kind,
          provider: "SANDBOX",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await api(`payments/${payment.id}/sandbox-confirm`, { method: "POST" });
      notify("Sandbox payment recorded. No real money was charged.");
      await Promise.all([load(), refresh()]);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  async function status(b: Booking, status: string) {
    setBusy(b.id);
    try {
      if (status === "CANCELLED" && b.status === "CONFIRMED") {
        await api("disputes", {
          method: "POST",
          body: json({ bookingId: b.id, reason }),
        });
        notify(
          "Cancellation review requested. An administrator will review your refund.",
        );
        setCancel(null);
        return;
      }
      await api(`bookings/${b.id}/status`, {
        method: "PATCH",
        body: json({ status }),
      });
      await Promise.all([load(), refresh()]);
      notify("Booking updated");
      setCancel(null);
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy("");
    }
  }
  const visible =
    user?.role === "VENDOR"
      ? items
      : items.filter((b) => b.eventId === event?.id);
  return (
    <>
      <PageHeading
        eyebrow="YOUR DREAM TEAM, COMING TOGETHER"
        title="My bookings"
        description="Dates held, details confirmed, and one less thing on your mind."
        action={
          <Link className="button primary" href="/vendors">
            <Plus size={18} />
            Find a vendor
          </Link>
        }
      />
      <div className="info-note">
        <CreditCard size={20} />
        <span>
          Sandbox checkout is available for testing. It never charges real
          money. Holds expire after 15 minutes.
        </span>
      </div>
      <div className="booking-list">
        {visible.map((b) => (
          <article className="card booking-card" key={b.id}>
            <div
              className="booking-thumb"
              style={{ backgroundImage: `url("${b.service.vendor?.image}")` }}
            />
            <div className="booking-main">
              <Badge value={b.status} />
              <h2>{b.service.vendor?.businessName || b.service.title}</h2>
              <p>{b.service.title}</p>
              <span className="detail-meta">
                <CalendarDays size={16} />
                {dateLabel(b.startAt)} ·{" "}
                {new Date(b.startAt).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Dhaka",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                BST
              </span>
              {["HELD", "AWAITING_ADVANCE"].includes(b.status) && (
                <small className="hold-note">
                  Hold expires{" "}
                  {new Date(b.holdExpiresAt).toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Dhaka",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  (Asia/Dhaka)
                </small>
              )}
            </div>
            <div className="booking-actions">
              <strong className="booking-total">{taka(b.priceMinor)}</strong>
              {user?.role === "VENDOR" &&
                ["HELD", "AWAITING_ADVANCE"].includes(b.status) && (
                  <Button onClick={() => void vendorAction(b, "confirm")}>
                    Confirm booking
                  </Button>
                )}
              {user?.role === "VENDOR" && b.status === "CONFIRMED" && (
                <Button
                  variant="secondary"
                  onClick={() => void vendorAction(b, "payment")}
                >
                  Record a payment
                </Button>
              )}
              {user?.role !== "VENDOR" &&
                !sandbox &&
                ["HELD", "AWAITING_ADVANCE"].includes(b.status) && (
                  <small className="hold-note">
                    Waiting for the vendor to confirm
                  </small>
                )}
              {user?.role !== "VENDOR" &&
                sandbox &&
                ["HELD", "AWAITING_ADVANCE"].includes(b.status) && (
                  <Button
                    busy={busy === b.id}
                    onClick={() => void pay(b, "ADVANCE")}
                  >
                    Test advance · {taka(b.advanceMinor)}
                  </Button>
                )}
              {user?.role !== "VENDOR" &&
                sandbox &&
                b.status === "CONFIRMED" && (
                  <Button
                    variant="secondary"
                    busy={busy === b.id}
                    onClick={() => void pay(b, "BALANCE")}
                  >
                    Test balance payment
                  </Button>
                )}
              {user?.role === "VENDOR" &&
                b.status === "CONFIRMED" &&
                new Date(b.endAt) < new Date() && (
                  <Button
                    onClick={() => void status(b, "COMPLETED")}
                    busy={busy === b.id}
                  >
                    Mark completed
                  </Button>
                )}
              {["HELD", "AWAITING_ADVANCE", "CONFIRMED"].includes(b.status) && (
                <button
                  className="text-link muted"
                  onClick={() => setCancel(b)}
                >
                  <X size={15} />
                  Cancel booking
                </button>
              )}
              {user?.role !== "VENDOR" && b.status === "COMPLETED" && (
                <Button variant="secondary" onClick={() => setReview(b)}>
                  <Star size={16} />
                  Leave a review
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!visible.length && (
        <Empty title="Your dream team is waiting">
          <Link href="/vendors">Explore vendors and hold your first date.</Link>
        </Empty>
      )}
      {cancel && (
        <Modal title="Cancel this booking?" onClose={() => setCancel(null)}>
          {cancel.status === "CONFIRMED" && (
            <Field label="Reason for cancellation review">
              <textarea
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Tell us what changed (at least 10 characters)"
              />
            </Field>
          )}
          <p>
            Cancel your reservation with{" "}
            {cancel.service.vendor?.businessName || cancel.service.title}?
            Unpaid holds are released immediately. Paid bookings require an
            administrator refund review.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setCancel(null)}>
              Keep booking
            </Button>
            <Button
              busy={busy === cancel.id}
              onClick={() => void status(cancel, "CANCELLED")}
            >
              {cancel.status === "CONFIRMED"
                ? "Request cancellation review"
                : "Confirm cancellation"}
            </Button>
          </div>
        </Modal>
      )}
      {review && (
        <Modal
          title="A little appreciation goes a long way"
          onClose={() => setReview(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(review.id);
              try {
                await api("reviews", {
                  method: "POST",
                  body: json({
                    bookingId: review.id,
                    rating: Number(f.get("rating")),
                    body: f.get("body"),
                  }),
                });
                notify("Thank you for sharing your experience");
                setReview(null);
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy("");
              }
            }}
          >
            <Field label="Your rating">
              <select name="rating">
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} stars
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Your experience">
              <textarea name="body" required minLength={5} maxLength={2000} />
            </Field>
            <Button busy={busy === review.id}>Publish review</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
