"use client";
import Link from "next/link";
import { MessageSquareText, Phone } from "lucide-react";
import "@/app/tools.css";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { dateLabel, taka } from "@/lib/format";
import { useResource } from "@/lib/use-resource";
import type { Paged } from "@/lib/types";
import { Badge, CardHeading, Empty } from "./ui";

type Inquiry = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  eventDate?: string | null;
  guestCount?: number | null;
  budgetMinor?: number | null;
  message: string;
  status: string;
  conversationId?: string | null;
  createdAt: string;
};

/** New inquiries from families. Replying quickly improves the vendor's response badge. */
export function InquiryInbox({ vendorId }: { vendorId: string }) {
  const { notify } = useApp();
  const inbox = useResource<Paged<Inquiry> | null>(
    `vendors/${vendorId}/inquiries?limit=20`,
    null,
  );
  async function setStatus(id: string, status: string) {
    try {
      await api(`inquiries/${id}`, { method: "PATCH", body: json({ status }) });
      await inbox.reload();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <section className="card padded" id="inquiries">
      <CardHeading
        title="Inquiries"
        subtitle="Families who asked about your services. Reply within a day to win more bookings."
      />
      {inbox.data?.items.map((i) => (
        <article key={i.id} className="side-card" style={{ marginBottom: 12 }}>
          <strong>
            {i.name} <Badge value={i.status} />
          </strong>
          <small className="muted">
            {dateLabel(i.createdAt)}
            {i.eventDate ? ` · event ${dateLabel(i.eventDate)}` : ""}
            {i.guestCount ? ` · ${i.guestCount} guests` : ""}
            {i.budgetMinor ? ` · budget ${taka(i.budgetMinor)}` : ""}
          </small>
          <p>{i.message}</p>
          <div className="button-group">
            {i.conversationId && (
              <Link
                className="button secondary"
                href={`/messages?c=${i.conversationId}`}
              >
                <MessageSquareText size={16} /> Reply
              </Link>
            )}
            {i.phone && (
              <a className="button ghost" href={`tel:${i.phone}`}>
                <Phone size={16} /> {i.phone}
              </a>
            )}
            <select
              aria-label="Inquiry status"
              value={i.status}
              onChange={(e) => void setStatus(i.id, e.target.value)}
            >
              <option value="NEW">New</option>
              <option value="REPLIED">Replied</option>
              <option value="QUOTED">Quoted</option>
              <option value="BOOKED">Booked</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </article>
      ))}
      {inbox.data && !inbox.data.items.length && (
        <Empty title="No inquiries yet">
          Share your profile link on Facebook to receive inquiries.
        </Empty>
      )}
    </section>
  );
}
