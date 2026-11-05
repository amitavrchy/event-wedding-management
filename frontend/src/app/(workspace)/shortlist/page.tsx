"use client";
import { useState } from "react";
import { useApp } from "@/lib/context";
import { Heart, Columns3, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useResource, useAction } from "@/lib/use-resource";
import { Vendor } from "@/lib/types";
import { taka } from "@/lib/format";
import { VendorCard } from "@/components/vendor-card";
import { BookingModal } from "@/components/booking-modal";
import { Button, Empty, PageHeading } from "@/components/ui";
export default function Shortlist() {
  const { event } = useApp();
  const { data: recommendations } = useResource<
    { vendor: Vendor; score: number; reasons: string[] }[]
  >(event ? `events/${event.id}/recommendations` : null, []);
  const { data, reload } = useResource<Vendor[]>("favorites", []);
  const { busy, run } = useAction();
  const [selected, setSelected] = useState<Vendor | null>(null),
    [compared, setCompared] = useState<string[]>([]);
  const comparison = data.filter((v) => compared.includes(v.id));
  return (
    <>
      <PageHeading
        eyebrow="THE PEOPLE WHO FEEL LIKE THE ONE"
        title="Your dream-team shortlist"
        description="Keep your favorite professionals close and compare the details that matter to your day."
      />
      <div className="vendor-grid">
        {data.map((v) => (
          <div className="shortlist-item" key={v.id}>
            <VendorCard vendor={v} onSelect={setSelected} />
            <div className="shortlist-actions">
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={compared.includes(v.id)}
                  disabled={!compared.includes(v.id) && compared.length >= 4}
                  onChange={(e) =>
                    setCompared((current) =>
                      e.target.checked
                        ? [...current, v.id]
                        : current.filter((id) => id !== v.id),
                    )
                  }
                />
                Compare
              </label>
              <button
                className="icon-button"
                aria-label={`Remove ${v.businessName} from shortlist`}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`favorites/${v.id}`, { method: "DELETE" });
                    setCompared((current) =>
                      current.filter((id) => id !== v.id),
                    );
                    await reload();
                  }, "Shortlist updated")
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {!data.length && (
        <Empty title="Keep a little room for your dream team">
          Open a professional in Find vendors and save them to your shortlist.
        </Empty>
      )}
      {comparison.length > 0 && (
        <section className="card section-gap comparison-table">
          <div className="card-heading">
            <div>
              <h2>A thoughtful side-by-side</h2>
              <p>
                Choose up to four professionals. Published prices are starting
                prices; compare the included service details before booking.
              </p>
            </div>
            <Columns3 size={24} />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>What matters</th>
                  {comparison.map((v) => (
                    <th key={v.id}>{v.businessName}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Specialty</td>
                  {comparison.map((v) => (
                    <td key={v.id}>{v.category}</td>
                  ))}
                </tr>
                <tr>
                  <td>City</td>
                  {comparison.map((v) => (
                    <td key={v.id}>{v.city}</td>
                  ))}
                </tr>
                <tr>
                  <td>Starting price</td>
                  {comparison.map((v) => (
                    <td key={v.id}>
                      {v.services.length
                        ? taka(
                            Math.min(
                              ...v.services.map((s) => s.basePriceMinor),
                            ),
                          )
                        : "Ask for a quote"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Service duration</td>
                  {comparison.map((v) => (
                    <td key={v.id}>
                      {v.services
                        .map((s) => `${s.durationHours}h`)
                        .join(" / ") || "To be discussed"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Capacity</td>
                  {comparison.map((v) => (
                    <td key={v.id}>
                      {v.services
                        .filter((s) => s.capacity)
                        .map((s) => s.capacity)
                        .join(" / ") || "Not specified"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Setup buffer</td>
                  {comparison.map((v) => (
                    <td key={v.id}>
                      {v.services.map((s) => `${s.bufferHours}h`).join(" / ") ||
                        "To be discussed"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Your next step</td>
                  {comparison.map((v) => (
                    <td key={v.id}>
                      <Button
                        variant="secondary"
                        onClick={() => setSelected(v)}
                      >
                        Check a date
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      {recommendations.length > 0 && (
        <section className="recommendations-section">
          <div className="card-heading">
            <div>
              <h2>A few thoughtful matches</h2>
              <p>
                Ranked from your city, category budget, guest capacity, and next
                celebration date.
              </p>
            </div>
          </div>
          <div className="vendor-grid">
            {recommendations.slice(0, 6).map((match) => (
              <article className="recommended-vendor" key={match.vendor.id}>
                <VendorCard vendor={match.vendor} onSelect={setSelected} />
                <div className="match-details">
                  <span className="match-score">
                    {match.score}/100 planning match
                  </span>
                  {match.reasons.map((reason) => (
                    <p key={reason}>✓ {reason}</p>
                  ))}
                  <Button
                    variant="secondary"
                    disabled={data.some((v) => v.id === match.vendor.id)}
                    busy={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(`favorites/${match.vendor.id}`, {
                          method: "POST",
                        });
                        await reload();
                      }, "Professional saved to shortlist")
                    }
                  >
                    {data.some((v) => v.id === match.vendor.id)
                      ? "Saved to your shortlist"
                      : "Save this professional"}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <BookingModal vendor={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
