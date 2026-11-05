"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Sparkles } from "lucide-react";
import { Bundle } from "@/lib/types";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { localDateToISO, taka } from "@/lib/format";
import { Button, Field, Modal } from "./ui";
export function CollectionCheckout({
  bundle,
  onClose,
}: {
  bundle: Bundle;
  onClose: () => void;
}) {
  const { event, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Modal title={bundle.title} onClose={onClose}>
      <div className="info-note">
        <Sparkles size={20} />
        <span>
          Reserve every professional together and save{" "}
          {bundle.discountBps / 100}%. All dates are held together for 15
          minutes. If any date is unavailable, no hold is created.
        </span>
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!event) return;
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("cart/hold", {
              method: "POST",
              body: json({
                eventId: event.id,
                packageId: bundle.id === "custom" ? undefined : bundle.id,
                items: bundle.services.map((s) => ({
                  serviceId: s.id,
                  startAt: localDateToISO(String(f.get("startAt"))),
                })),
              }),
            });
            await refresh();
            notify(
              "Your whole collection is held. Pay each vendor’s advance to confirm.",
            );
            onClose();
            router.push("/bookings");
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        {bundle.services.map((s) => (
          <div className="checkout-item" key={s.id}>
            <Check size={17} />
            <div>
              <strong>{s.vendor?.businessName || s.title}</strong>
              <p>
                {s.durationHours} hour service ·{" "}
                {taka(
                  Math.round(
                    (s.basePriceMinor * (10000 - bundle.discountBps)) / 10000,
                  ),
                )}
              </p>
            </div>
          </div>
        ))}
        <Field label="Date and start time for all services (Asia/Dhaka)">
          <input name="startAt" type="datetime-local" required />
        </Field>
        <div className="checkout-total">
          <span>Collection total</span>
          <strong>{taka(bundle.priceMinor)}</strong>
        </div>
        <Button busy={busy} disabled={!event}>
          <CalendarDays size={18} />
          Hold the whole collection
        </Button>
        {!event && (
          <p className="helper-text">
            Create a celebration to reserve this collection.
          </p>
        )}
      </form>
    </Modal>
  );
}
