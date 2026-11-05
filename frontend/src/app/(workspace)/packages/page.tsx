"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gift, Check, ArrowRight, Plus } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { taka, dateLabel } from "@/lib/format";
import { Bundle, Quote, Vendor } from "@/lib/types";
import {
  Badge,
  Button,
  CardHeading,
  Empty,
  Modal,
  PageHeading,
} from "@/components/ui";
import { CollectionCheckout } from "@/components/collection-checkout";
import { QuoteCheckout } from "@/components/quote-checkout";
export default function Packages() {
  const { event, notify, vendors } = useApp();
  const [bundles, setBundles] = useState<Bundle[]>([]),
    [quotes, setQuotes] = useState<Quote[]>([]),
    [selected, setSelected] = useState<Bundle | null>(null),
    [composing, setComposing] = useState(false),
    [bookingQuote, setBookingQuote] = useState<Quote | null>(null),
    [busy, setBusy] = useState("");
  async function load() {
    try {
      setBundles(await api<Bundle[]>("packages"));
      if (event) setQuotes(await api<Quote[]>(`quotes/event/${event.id}`));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    void load();
  }, [event?.id]);
  return (
    <>
      <PageHeading
        eyebrow="THOUGHTFULLY PUT TOGETHER"
        title="A little more, together"
        description="Explore curated collections and keep your custom quotes close."
        action={
          <Button onClick={() => setComposing(true)}>
            <Plus size={18} />
            Build your collection
          </Button>
        }
      />
      <div className="package-grid">
        {bundles.map((b) => (
          <article className="card package-card" key={b.id}>
            <div className="package-decoration">
              <Gift size={36} />
              <span>THE LITTLE DETAILS, ALREADY CONSIDERED</span>
            </div>
            <div className="package-content">
              <span className="eyebrow">
                A CURATED CELEBRATION · {b.discountBps / 100}% BUNDLE DISCOUNT
              </span>
              <h2>{b.title}</h2>
              <p>{b.description}</p>
              <ul>
                {b.services.map((s) => (
                  <li key={s.id}>
                    <Check size={17} />
                    {s.vendor?.businessName || s.title}
                  </li>
                ))}
              </ul>
              <div className="package-price">
                <span>Collection estimate</span>
                <strong>{taka(b.priceMinor)}</strong>
              </div>
              <Button onClick={() => setSelected(b)}>
                Explore the collection <ArrowRight size={18} />
              </Button>
            </div>
          </article>
        ))}
      </div>
      {!bundles.length && (
        <Empty title="Beautiful collections are on their way" />
      )}
      <section className="card section-gap">
        <CardHeading
          title="Made just for you"
          subtitle="Custom quotes from your wedding professionals."
        />
        <div className="quote-list">
          {quotes.map((q) => (
            <div className="quote-row" key={q.id}>
              <div>
                <h3>
                  {vendors.find((v) => v.id === q.vendorId)?.businessName ||
                    "Custom vendor quote"}
                </h3>
                <p>Valid until {dateLabel(q.expiresAt)}</p>
                <details>
                  <summary>View breakdown</summary>
                  {q.breakdown.map((b, i) => (
                    <p key={i}>
                      {b.label} · {taka(b.amountMinor)}
                    </p>
                  ))}
                </details>
              </div>
              <strong>{taka(q.amountMinor)}</strong>
              <Badge value={q.status} />
              {q.status === "ACCEPTED" &&
                vendors.some((v) => v.id === q.vendorId) && (
                  <Button
                    variant="secondary"
                    onClick={() => setBookingQuote(q)}
                  >
                    Book this quote
                  </Button>
                )}
              {q.status === "SENT" && (
                <div className="button-group">
                  {["ACCEPTED", "REJECTED"].map((status) => (
                    <Button
                      key={status}
                      variant={status === "ACCEPTED" ? "primary" : "secondary"}
                      busy={busy === q.id}
                      onClick={async () => {
                        setBusy(q.id);
                        try {
                          await api(`quotes/${q.id}/respond`, {
                            method: "POST",
                            body: json({ status }),
                          });
                          await load();
                          notify("Your response has been saved");
                        } catch (e) {
                          notify((e as Error).message, true);
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      {status === "ACCEPTED" ? "Accept" : "Decline"}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!quotes.length && (
            <Empty title="A celebration as unique as you">
              <Link href="/messages">
                Message a vendor to discuss a custom quote.
              </Link>
            </Empty>
          )}
        </div>
      </section>
      {composing && (
        <Modal
          title="Your people. Your own collection."
          onClose={() => setComposing(false)}
        >
          <p>
            Choose up to 10 services. Reserve everyone together in one step.
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                ids = f.getAll("services");
              const services = vendors
                .flatMap((v) => v.services.map((s) => ({ ...s, vendor: v })))
                .filter((s) => ids.includes(s.id));
              if (!services.length || services.length > 10) {
                notify("Choose between 1 and 10 services", true);
                return;
              }
              setSelected({
                id: "custom",
                title: "Your personal collection",
                description: "Your handpicked celebration team",
                priceMinor: services.reduce(
                  (sum, s) => sum + s.basePriceMinor,
                  0,
                ),
                discountBps: 0,
                services,
              });
              setComposing(false);
            }}
          >
            {vendors.flatMap((v) =>
              v.services.map((s) => (
                <label className="check-field" key={s.id}>
                  <input type="checkbox" name="services" value={s.id} />
                  <span>
                    {v.businessName} · {taka(s.basePriceMinor)}
                  </span>
                </label>
              )),
            )}
            <Button>
              Choose your date <ArrowRight size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {selected && (
        <CollectionCheckout
          bundle={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {bookingQuote && (
        <QuoteCheckout
          quote={bookingQuote}
          vendor={vendors.find((v) => v.id === bookingQuote.vendorId)!}
          onClose={() => setBookingQuote(null)}
        />
      )}
    </>
  );
}
