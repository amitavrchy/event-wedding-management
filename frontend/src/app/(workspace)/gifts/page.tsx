"use client";
import { useState } from "react";
import {
  Plus,
  Download,
  Gift as GiftIcon,
  HandCoins,
  MailCheck,
  Trash2,
} from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import { dateLabel, taka } from "@/lib/format";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";

type Gift = {
  id: string;
  giverName: string;
  side: string | null;
  kind: "CASH" | "GIFT" | "GOLD" | "OTHER";
  amountMinor: number | null;
  description: string | null;
  receivedAt: string;
  thankYouSentAt: string | null;
};
type Register = {
  items: Gift[];
  summary: {
    count: number;
    cashMinor: number;
    thankYouPending: number;
    byKind: { kind: string; count: number }[];
  };
};
const KIND = {
  CASH: "Cash / salami",
  GIFT: "Gift",
  GOLD: "Gold / jewellery",
  OTHER: "Other",
};

export default function Gifts() {
  const { event, notify } = useApp();
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [q, setQ] = useState("");
  const path = event
    ? `events/${event.id}/gifts?${new URLSearchParams({ ...(pending ? { pending: "true" } : {}), ...(q ? { q } : {}) })}`
    : null;
  const register = useResource<Register | null>(path, null);
  if (!event) return <Empty title="Create a celebration first" />;
  const hasSides = event.features?.includes("sides");
  const readOnly = event.access === "VIEWER";
  async function update(id: string, body: object) {
    try {
      await api(`events/${event!.id}/gifts/${id}`, {
        method: "PATCH",
        body: json(body),
      });
      await register.reload();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="উপহার খাতা"
        title="Gift register"
        description="Record every gift and salami, and never forget a thank-you."
        action={
          !readOnly && (
            <Button onClick={() => setAdding(true)}>
              <Plus size={18} /> Record a gift
            </Button>
          )
        }
      />
      {register.data && (
        <div className="mini-stats">
          <article>
            <GiftIcon size={22} />
            <strong>{register.data.summary.count}</strong>
            <span>Gifts recorded</span>
          </article>
          <article>
            <HandCoins size={22} />
            <strong>{taka(register.data.summary.cashMinor, true)}</strong>
            <span>Cash and salami</span>
          </article>
          <article>
            <MailCheck size={22} />
            <strong>{register.data.summary.thankYouPending}</strong>
            <span>Thank-yous to send</span>
          </article>
        </div>
      )}
      <div className="filter-bar">
        <div className="search-field">
          <input
            aria-label="Search givers"
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            checked={pending}
            onChange={(e) => setPending(e.target.checked)}
          />
          <span>Only thank-yous pending</span>
        </label>
        <a
          className="button secondary"
          href={`/api/events/${event.id}/gifts.csv`}
        >
          <Download size={17} /> Export
        </a>
      </div>
      <section className="card table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>From</th>
                {hasSides && <th>Side</th>}
                <th>Gift</th>
                <th>Received</th>
                <th>Thank-you</th>
                {!readOnly && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {register.data?.items.map((g) => (
                <tr key={g.id}>
                  <td>
                    <strong>{g.giverName}</strong>
                  </td>
                  {hasSides && (
                    <td>
                      {g.side
                        ? event.sides?.[g.side]?.label || g.side.toLowerCase()
                        : "—"}
                    </td>
                  )}
                  <td>
                    {KIND[g.kind]}
                    {g.amountMinor != null && (
                      <strong> · {taka(g.amountMinor)}</strong>
                    )}
                    {g.description && (
                      <small className="block muted">{g.description}</small>
                    )}
                  </td>
                  <td>{dateLabel(g.receivedAt)}</td>
                  <td>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={Boolean(g.thankYouSentAt)}
                        onChange={(e) =>
                          void update(g.id, { thankYouSent: e.target.checked })
                        }
                      />
                      <span>{g.thankYouSentAt ? "Sent" : "Pending"}</span>
                    </label>
                  </td>
                  {!readOnly && (
                    <td className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Delete gift from ${g.giverName}`}
                        onClick={async () => {
                          if (!window.confirm("Delete this gift record?"))
                            return;
                          try {
                            await api(`events/${event.id}/gifts/${g.id}`, {
                              method: "DELETE",
                            });
                            await register.reload();
                          } catch (e) {
                            notify((e as Error).message, true);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!register.data?.items.length && (
          <Empty title="No gifts recorded yet">
            Record gifts as they arrive on the day.
          </Empty>
        )}
      </section>
      {adding && (
        <Modal title="Record a gift" onClose={() => setAdding(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              try {
                await api(`events/${event.id}/gifts`, {
                  method: "POST",
                  body: json({
                    giverName: f.get("giverName"),
                    kind: f.get("kind"),
                    amountMinor: f.get("amount")
                      ? Math.round(Number(f.get("amount")) * 100)
                      : undefined,
                    description: f.get("description") || undefined,
                    side: f.get("side") || null,
                  }),
                });
                await register.reload();
                (e.target as HTMLFormElement).reset();
                notify("Gift recorded. Add the next one.");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="From">
              <input
                name="giverName"
                required
                minLength={2}
                placeholder="Nasrin Khala"
                autoFocus
              />
            </Field>
            <div className="form-row">
              <Field label="Type">
                <select name="kind" defaultValue="CASH">
                  {Object.entries(KIND).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Amount or value (৳)">
                <input name="amount" type="number" min="0" step="1" />
              </Field>
            </div>
            {hasSides && (
              <Field label="Side">
                <select name="side" defaultValue="">
                  <option value="">Not assigned</option>
                  <option value="BRIDE">
                    {event.sides?.BRIDE?.label || "Bride's side"}
                  </option>
                  <option value="GROOM">
                    {event.sides?.GROOM?.label || "Groom's side"}
                  </option>
                </select>
              </Field>
            )}
            <Field label="Description">
              <input
                name="description"
                maxLength={300}
                placeholder="Dinner set, gold ring…"
              />
            </Field>
            <Button busy={busy}>Save gift</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
