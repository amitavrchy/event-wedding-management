"use client";
import { useState } from "react";
import {
  Receipt,
  Printer,
  CalendarClock,
  Wallet,
  Download,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useAction, useResource } from "@/lib/use-resource";
import { Invoice, Installment } from "@/lib/advanced";
import { taka, dateLabel } from "@/lib/format";
import { downloadCSV } from "@/lib/csv";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
export default function Finance() {
  const { event, user } = useApp();
  const vendor = user?.role === "VENDOR";
  const { data, reload } = useResource<Invoice[]>(
    vendor ? "invoices/business" : event ? `invoices/event/${event.id}` : null,
    [],
  );
  const { busy, run } = useAction();
  const [selected, setSelected] = useState<Invoice | null>(null),
    [plan, setPlan] = useState<Invoice | null>(null);
  const active = data.filter(
      (i) => !["CANCELLED", "EXPIRED"].includes(i.booking.status),
    ),
    paid = active.reduce((s, i) => s + i.paidMinor, 0),
    outstanding = active.reduce((s, i) => s + i.outstandingMinor, 0);
  async function pay(invoice: Invoice, installment?: Installment) {
    await run(async () => {
      const intent = await api<{ id: string }>("payments", {
        method: "POST",
        body: json({
          bookingId: invoice.booking.id,
          provider: "SANDBOX",
          kind: installment ? "INSTALLMENT" : "BALANCE",
          installmentId: installment?.id,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      await api(`payments/${intent.id}/sandbox-confirm`, { method: "POST" });
      await reload();
      setSelected(null);
    }, "Sandbox payment recorded. No real money moved.");
  }
  return (
    <>
      <PageHeading
        eyebrow="EVERY PROMISE, EVERY PAYMENT"
        title="The finance desk"
        description="Clear invoices, flexible balance milestones, and a complete trail of every payment."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              downloadCSV(
                "utsab-invoices.csv",
                [
                  "Invoice",
                  "Vendor",
                  "Total BDT",
                  "Paid BDT",
                  "Outstanding BDT",
                  "Status",
                ],
                data.map((i) => [
                  i.number,
                  i.booking.service.vendor?.businessName ||
                    i.booking.service.title,
                  String(i.booking.priceMinor / 100),
                  String(i.paidMinor / 100),
                  String(i.outstandingMinor / 100),
                  i.status,
                ]),
              )
            }
          >
            <Download size={17} />
            Export invoices
          </Button>
        }
      />
      <div className="advanced-metrics">
        <div>
          <Receipt />
          <strong>{active.length}</strong>
          <span>Active invoices</span>
        </div>
        <div>
          <strong>{taka(paid, true)}</strong>
          <span>Captured payments</span>
        </div>
        <div>
          <strong>{taka(outstanding, true)}</strong>
          <span>Outstanding balance</span>
        </div>
        <div>
          <CalendarClock />
          <strong>
            {
              data
                .flatMap((i) => i.installments)
                .filter((i) => i.status === "PENDING").length
            }
          </strong>
          <span>Upcoming milestones</span>
        </div>
      </div>
      <div className="info-note">
        <Wallet size={20} />
        <span>
          All checkout actions currently use sandbox payments. You can schedule
          and test each installment without charging real money.
        </span>
      </div>
      <section className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Professional</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Remaining</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.booking.id}>
                  <td>
                    <strong>{i.number}</strong>
                    <small>{dateLabel(i.booking.startAt)}</small>
                  </td>
                  <td>
                    {i.booking.service.vendor?.businessName ||
                      i.booking.service.title}
                  </td>
                  <td>{taka(i.booking.priceMinor)}</td>
                  <td>{taka(i.paidMinor)}</td>
                  <td>{taka(i.outstandingMinor)}</td>
                  <td>
                    <Badge value={i.status} />
                  </td>
                  <td>
                    <Button variant="secondary" onClick={() => setSelected(i)}>
                      Open invoice
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.length && (
          <Empty title="Your next beautiful booking starts the story">
            Invoices appear when you hold a professional’s date.
          </Empty>
        )}
      </section>
      {selected && (
        <Modal title={selected.number} onClose={() => setSelected(null)}>
          <section className="invoice-paper">
            <div className="contract-stamp">
              <span className="brand">
                utsab<span>✳</span>
              </span>
              <Badge value={selected.status} />
            </div>
            <h2>Invoice {selected.number}</h2>
            <p>
              {selected.booking.service.vendor?.businessName} ·{" "}
              {selected.booking.event?.title || event?.title}
            </p>
            <p>Celebration date: {dateLabel(selected.booking.startAt)}</p>
            <div className="invoice-line">
              <strong>{selected.booking.service.title}</strong>
              <span>{taka(selected.booking.priceMinor)}</span>
            </div>
            <div className="invoice-line">
              <span>Captured payments</span>
              <strong>{taka(selected.paidMinor)}</strong>
            </div>
            <div className="checkout-total">
              <span>Outstanding</span>
              <strong>{taka(selected.outstandingMinor)}</strong>
            </div>
          </section>
          <div className="button-group section-gap">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={17} />
              Print / save PDF
            </Button>
            {!vendor &&
              selected.booking.status === "CONFIRMED" &&
              selected.outstandingMinor > 0 &&
              !selected.installments.length && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPlan(selected);
                    setSelected(null);
                  }}
                >
                  <CalendarClock size={17} />
                  Create payment plan
                </Button>
              )}
          </div>
          <h3 className="section-gap">Payment milestones</h3>
          <div className="installment-list">
            {selected.installments.map((i) => (
              <div className="installment-row" key={i.id}>
                <div>
                  <strong>{i.label}</strong>
                  <p>{dateLabel(i.dueAt)}</p>
                </div>
                <strong>{taka(i.amountMinor)}</strong>
                <Badge value={i.status} />
                {!vendor && i.status === "PENDING" && (
                  <Button busy={busy} onClick={() => void pay(selected, i)}>
                    Test payment
                  </Button>
                )}
              </div>
            ))}
          </div>
          {!vendor &&
            selected.booking.status === "CONFIRMED" &&
            selected.outstandingMinor > 0 && (
              <Button
                variant="secondary"
                busy={busy}
                onClick={() => void pay(selected)}
              >
                Test full remaining balance
              </Button>
            )}
          <h3 className="section-gap">Transaction trail</h3>
          {selected.payments.length ? (
            selected.payments.map((p) => (
              <div className="invoice-line" key={p.id}>
                <span>
                  {p.kind.toLowerCase()} · {p.provider}
                </span>
                <span>
                  {taka(p.amountMinor)} <Badge value={p.status} />
                </span>
              </div>
            ))
          ) : (
            <p className="muted section-gap">No payments recorded.</p>
          )}
        </Modal>
      )}
      {plan && (
        <Modal
          title="A little flexibility, thoughtfully planned"
          onClose={() => setPlan(null)}
        >
          <p>
            Split the remaining {taka(plan.outstandingMinor)} into equal
            milestones. The last milestone includes any rounding remainder.
          </p>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                count = Number(f.get("count")),
                gap = Number(f.get("gap")),
                base = Math.floor(plan.outstandingMinor / count),
                start = +new Date(`${f.get("date")}T18:00:00+06:00`);
              if (
                await run(async () => {
                  await api(`invoices/${plan.booking.id}/plan`, {
                    method: "POST",
                    body: json({
                      installments: Array.from({ length: count }, (_, n) => ({
                        label: `Balance milestone ${n + 1}`,
                        amountMinor:
                          n === count - 1
                            ? plan.outstandingMinor - base * (count - 1)
                            : base,
                        dueAt: new Date(
                          start + n * gap * 86400000,
                        ).toISOString(),
                      })),
                    }),
                  });
                  await reload();
                }, "Your payment plan is saved")
              )
                setPlan(null);
            }}
          >
            <Field label="Number of installments">
              <input
                name="count"
                type="number"
                min="1"
                max="12"
                defaultValue="3"
                required
              />
            </Field>
            <Field label="First payment date (Asia/Dhaka)">
              <input name="date" type="date" required />
            </Field>
            <Field label="Days between payments">
              <input
                name="gap"
                type="number"
                min="1"
                max="90"
                defaultValue="30"
                required
              />
            </Field>
            <Button busy={busy}>Save milestones</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
