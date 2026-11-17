"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { localDateToISO, taka } from "@/lib/format";
import { Quote, Vendor } from "@/lib/types";
import { Button, Field, Modal } from "./ui";
export function QuoteCheckout({
  quote,
  vendor,
  onClose,
}: {
  quote: Quote;
  vendor: Vendor;
  onClose: () => void;
}) {
  const { event, refresh, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <Modal title="A celebration, made personal" onClose={onClose}>
      <p>
        Your accepted quote from {vendor.businessName}:{" "}
        <strong>{taka(quote.amountMinor)}</strong>. The quoted total is
        snapshotted when your date is held.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("bookings", {
              method: "POST",
              body: json({
                eventId: event?.id,
                serviceId: f.get("serviceId"),
                startAt: localDateToISO(String(f.get("startAt"))),
                quoteId: quote.id,
              }),
            });
            await refresh();
            notify("Your custom quote and date are held for 15 minutes");
            onClose();
            router.push("/bookings");
          } catch (e) {
            notify((e as Error).message, true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Service covered by your quote">
          <select name="serviceId" required>
            {vendor.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date and time (Asia/Dhaka)">
          <input name="startAt" type="datetime-local" required />
        </Field>
        <Button busy={busy}>Hold at the quoted price</Button>
      </form>
    </Modal>
  );
}
