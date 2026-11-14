"use client";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { useResource } from "@/lib/use-resource";
import { whatsappLink } from "@/lib/whatsapp";
import { CardHeading, Empty } from "./ui";

type Link = {
  id: string;
  url?: string;
  arrivedAt: string | null;
  vendor?: { businessName: string; category: string; phone?: string | null };
  cues: number;
  cuesDone: number;
};

/** Each booked vendor's private day-of link, with live arrival and cue progress. */
export function VendorLinks({ eventId }: { eventId: string }) {
  const { notify } = useApp();
  const links = useResource<Link[]>(`events/${eventId}/vendor-links`, []);
  return (
    <section className="card table-card">
      <CardHeading
        title="Vendors on the day"
        subtitle="Send each vendor their link. They see only their cues and tap “I have arrived”."
        action={
          <button className="text-link" onClick={() => void links.reload()}>
            Refresh
          </button>
        }
      />
      <div className="table-scroll">
        <table>
          <tbody>
            {links.data.map((l) => (
              <tr key={l.id}>
                <td>
                  <strong>{l.vendor?.businessName}</strong>
                  <small className="block muted">{l.vendor?.category}</small>
                </td>
                <td>
                  {l.arrivedAt ? (
                    <span className="form-success">
                      <CheckCircle2 size={14} /> Arrived{" "}
                      {new Date(l.arrivedAt).toLocaleTimeString("en-GB", {
                        timeZone: "Asia/Dhaka",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ) : (
                    "Not arrived"
                  )}
                </td>
                <td>
                  {l.cuesDone}/{l.cues} cues done
                </td>
                <td className="row-actions">
                  {l.url && (
                    <>
                      <a
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                        href={whatsappLink(
                          `Your schedule for our event: ${l.url}`,
                          l.vendor?.phone,
                        )}
                      >
                        <MessageCircle size={15} /> WhatsApp
                      </a>
                      <button
                        className="text-link"
                        onClick={() =>
                          navigator.clipboard
                            .writeText(l.url!)
                            .then(() => notify("Link copied"))
                            .catch(() => notify("Clipboard unavailable", true))
                        }
                      >
                        <Copy size={15} /> Copy
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!links.data.length && (
        <Empty title="No confirmed vendors yet">
          Links appear once a booking is confirmed.
        </Empty>
      )}
    </section>
  );
}
