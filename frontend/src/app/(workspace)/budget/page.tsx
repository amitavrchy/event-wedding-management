"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  Wallet,
  ArrowDownLeft,
  CircleDollarSign,
  Pencil,
  Download,
  Paperclip,
  Trash2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json, uploadFile } from "@/lib/api";
import { taka } from "@/lib/format";
import { Payment, BudgetItem, Expense } from "@/lib/types";
import {
  Button,
  CardHeading,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
import { downloadCSV } from "@/lib/csv";
type Summary = {
  items: BudgetItem[];
  expenses: Expense[];
  payments: Payment[];
  committedMinor: number;
  actualMinor: number;
  plannedMinor: number;
  alert: boolean;
};
export default function Budget() {
  const { event, refresh, notify } = useApp();
  const [data, setData] = useState<Summary | null>(null),
    [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<BudgetItem | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!event) return;
    try {
      setData(await api<Summary>(`events/${event.id}/budget`));
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  useEffect(() => {
    void load();
  }, [event?.id]);
  if (!event)
    return <Empty title="Create a celebration to start your budget" />;
  const readOnly = event.access === "VIEWER";
  const splitOn = Boolean(event.features?.includes("costSplit"));
  async function editExpense(id: string, body: object) {
    try {
      await api(`events/${event!.id}/budget/expenses/${id}`, {
        method: "PATCH",
        body: json(body),
      });
      await load();
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function openReceipt(id: string) {
    try {
      const { url } = await api<{ url: string }>(`uploads/${id}/url`);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      notify((e as Error).message, true);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      if (editing)
        await api(
          `events/${event!.id}/budget/${encodeURIComponent(editing.category)}`,
          {
            method: "PUT",
            body: json({
              plannedMinor: Math.round(Number(f.get("amount")) * 100),
            }),
          },
        );
      else
        await api(`events/${event!.id}/budget/expenses`, {
          method: "POST",
          body: json({
            category: f.get("category"),
            note: f.get("note"),
            amountMinor: Math.round(Number(f.get("amount")) * 100),
          }),
        });
      await Promise.all([load(), refresh()]);
      setAdding(false);
      setEditing(null);
      notify("Budget updated. Every detail accounted for.");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="BIG DREAMS. THOUGHTFUL SPENDING."
        title="Your budget, beautifully balanced"
        description="Keep the joy in planning, and every taka in perspective."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add an expense
          </Button>
        }
      />
      <div className="budget-summary">
        {[
          {
            title: "Your planned budget",
            value: event.budgetMinor,
            icon: Wallet,
            color: "rose",
          },
          {
            title: "Committed to vendors",
            value: data?.committedMinor || 0,
            icon: CircleDollarSign,
            color: "sage",
          },
          {
            title: "Paid & spent",
            value: data?.actualMinor || 0,
            icon: ArrowDownLeft,
            color: "peach",
          },
        ].map((s) => (
          <article key={s.title} className="card budget-stat">
            <span className={`stat-icon ${s.color}`}>
              <s.icon size={22} />
            </span>
            <p>{s.title}</p>
            <h2>{taka(s.value)}</h2>
          </article>
        ))}
      </div>
      {data?.alert && (
        <div className="error-banner">
          Your confirmed commitments exceed your budget. Review your plans
          before your next booking.
        </div>
      )}
      <section className="card">
        <CardHeading
          title="Room for every lovely detail"
          subtitle="Category allocations and confirmed vendor commitments."
          action={
            <button
              className="text-link"
              onClick={() =>
                downloadCSV(
                  "utsab-budget.csv",
                  ["Category", "Planned BDT"],
                  (data?.items || []).map((i) => [
                    i.category,
                    String(i.plannedMinor / 100),
                  ]),
                )
              }
            >
              <Download size={17} />
              Export
            </button>
          }
        />
        <div className="budget-categories">
          {data?.items.map((item, i) => {
            const committed = event.bookings
              .filter(
                (b) =>
                  ["CONFIRMED", "COMPLETED"].includes(b.status) &&
                  b.category === item.category,
              )
              .reduce((s, b) => s + b.priceMinor, 0);
            return (
              <div className="budget-category" key={item.id}>
                <span className={`category-marker marker-${i % 6}`} />
                <div className="category-content">
                  <div>
                    <h3>{item.category}</h3>
                    <span>
                      {taka(committed)} committed{" "}
                      <span className="muted">
                        of {taka(item.plannedMinor)}
                      </span>
                    </span>
                  </div>
                  <div className="progress rose">
                    <span
                      style={{
                        width: `${Math.min(100, item.plannedMinor ? (committed / item.plannedMinor) * 100 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Edit ${item.category} budget`}
                  onClick={() => setEditing(item)}
                >
                  <Pencil size={16} />
                </button>
              </div>
            );
          })}
          {!data?.items.length && (
            <Empty title="Give every detail its own budget">
              Add category allocations in event settings.
            </Empty>
          )}
        </div>
      </section>
      <section className="card section-gap">
        <CardHeading
          title="The little extras"
          subtitle="Manual expenses, separate from vendor payments."
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Category</th>
                {splitOn && <th>Paid by</th>}
                <th className="align-right">Amount</th>
                {!readOnly && <th aria-label="Actions" />}
              </tr>
            </thead>
            <tbody>
              {data?.expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.note}
                    {e.receiptMediaId && (
                      <button
                        className="text-link"
                        onClick={() => void openReceipt(e.receiptMediaId!)}
                      >
                        Receipt
                      </button>
                    )}
                  </td>
                  <td>{e.category}</td>
                  {splitOn && (
                    <td>
                      <select
                        aria-label={`Who paid ${e.note}`}
                        disabled={readOnly}
                        value={e.paidBy || ""}
                        onChange={(ev) =>
                          void editExpense(e.id, {
                            paidBy: ev.target.value || null,
                          })
                        }
                      >
                        <option value="">Not set</option>
                        <option value="BRIDE">
                          {event.sides?.BRIDE?.label || "Bride's side"}
                        </option>
                        <option value="GROOM">
                          {event.sides?.GROOM?.label || "Groom's side"}
                        </option>
                        <option value="SHARED">Shared</option>
                      </select>
                    </td>
                  )}
                  <td className="align-right">{taka(e.amountMinor)}</td>
                  {!readOnly && (
                    <td className="row-actions">
                      <label
                        className="icon-button"
                        aria-label={`Attach receipt to ${e.note}`}
                        title="Attach receipt"
                      >
                        <Paperclip size={16} />
                        <input
                          type="file"
                          hidden
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={async (ev) => {
                            const file = ev.target.files?.[0];
                            if (!file) return;
                            try {
                              const media = await uploadFile(file, "RECEIPT");
                              await editExpense(e.id, {
                                receiptMediaId: media.id,
                              });
                              notify("Receipt attached");
                            } catch (err) {
                              notify((err as Error).message, true);
                            }
                          }}
                        />
                      </label>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${e.note}`}
                        onClick={async () => {
                          if (!window.confirm(`Delete "${e.note}"?`)) return;
                          try {
                            await api(
                              `events/${event.id}/budget/expenses/${e.id}`,
                              { method: "DELETE" },
                            );
                            await Promise.all([load(), refresh()]);
                          } catch (err) {
                            notify((err as Error).message, true);
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
        {!data?.expenses.length && (
          <Empty title="No extra expenses yet">
            Add outfits, favors, transport, or any other little detail.
          </Empty>
        )}
      </section>
      {(adding || editing) && (
        <Modal
          title={
            editing ? `Budget for ${editing.category}` : "Add a little detail"
          }
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        >
          <form className="form-stack" onSubmit={submit}>
            {!editing && (
              <>
                <Field label="Expense description">
                  <input
                    name="note"
                    required
                    minLength={2}
                    maxLength={300}
                    placeholder="Event invitations"
                  />
                </Field>
                <Field label="Category">
                  <select name="category">
                    {[
                      ...new Set([
                        ...(data?.items || []).map((item) => item.category),
                        "Venue",
                        "Catering",
                        "Decoration",
                        "Photography",
                        "Attire",
                        "Other",
                      ]),
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Amount in taka (৳)">
              <input
                name="amount"
                type="number"
                min="0"
                max="20000000"
                step="0.01"
                defaultValue={editing ? editing.plannedMinor / 100 : undefined}
                required
              />
            </Field>
            <Button busy={busy}>
              Save {editing ? "allocation" : "expense"}
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
