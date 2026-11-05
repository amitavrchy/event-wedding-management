"use client";
import { useState } from "react";
import {
  FileSignature,
  Plus,
  Printer,
  Download,
  ShieldCheck,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { useAction, useResource } from "@/lib/use-resource";
import { Contract } from "@/lib/advanced";
import { Vendor } from "@/lib/types";
import { taka, dateLabel } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
export default function Contracts() {
  const { event, user, notify } = useApp();
  const vendor = user?.role === "VENDOR";
  const { data, reload } = useResource<Contract[]>(
    vendor
      ? "contracts/business"
      : event
        ? `contracts/event/${event.id}`
        : null,
    [],
  );
  const { data: businesses } = useResource<Vendor[]>(
    vendor ? "vendors/mine" : null,
    [],
  );
  const [business, setBusiness] = useState(""),
    [adding, setAdding] = useState(false),
    [selected, setSelected] = useState<Contract | null>(null);
  const businessId = business || businesses[0]?.id;
  const { data: clients } = useResource<{ id: string; title: string }[]>(
    businessId ? `vendors/${businessId}/clients` : null,
    [],
  );
  const { busy, run } = useAction();
  function exportEvidence(c: Contract) {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `utsab-contract-${c.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <PageHeading
        eyebrow="CLEAR EXPECTATIONS. BEAUTIFUL BEGINNINGS."
        title="Agreements, together"
        description="Review the details, acknowledge with your account name, and keep a permanent signed record."
        action={
          vendor ? (
            <Button
              onClick={() => setAdding(true)}
              disabled={!businesses.length}
            >
              <Plus size={17} />
              Send an agreement
            </Button>
          ) : undefined
        }
      />
      <div className="document-intro">
        <FileSignature size={32} />
        <div>
          <h2>Every promise deserves clarity.</h2>
          <p>
            Published agreement text is fixed. Acknowledgements preserve the
            account identity, time, and document fingerprint.
          </p>
        </div>
      </div>
      <div className="document-grid">
        {data.map((c) => (
          <button
            key={c.id}
            className="card document-card"
            onClick={() => setSelected(c)}
          >
            <div className="document-card-top">
              <span className="stat-icon rose">
                <FileSignature size={22} />
              </span>
              <Badge value={c.status} />
            </div>
            <h2>{c.title}</h2>
            <p>{dateLabel(c.createdAt)}</p>
            <strong>{taka(c.amountMinor)}</strong>
            <span className="text-link">Review agreement ↗</span>
          </button>
        ))}
      </div>
      {!data.length && (
        <Empty title="Your agreements will feel right at home here">
          Professionals can send agreements after opening a client conversation.
        </Empty>
      )}
      {selected && (
        <Modal title={selected.title} onClose={() => setSelected(null)}>
          <div className="contract-paper">
            <div className="contract-stamp">
              <span className="brand">
                utsab<span>✳</span>
              </span>
              <Badge value={selected.status} />
            </div>
            <h2>{selected.title}</h2>
            <p className="contract-amount">
              Agreement reference: {taka(selected.amountMinor)}
            </p>
            <div className="contract-body">{selected.body}</div>
            <div className="document-proof">
              <ShieldCheck size={21} />
              <div>
                <strong>Document fingerprint</strong>
                <code>{selected.contentHash}</code>
                {selected.signedAt && (
                  <p>
                    Acknowledged by {selected.signerName} ·{" "}
                    {new Date(selected.signedAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Dhaka",
                    })}{" "}
                    (Asia/Dhaka)
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="button-group section-gap">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print / save PDF
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportEvidence(selected)}
            >
              <Download size={16} />
              Download record
            </Button>
            {vendor && selected.status === "SENT" && (
              <Button
                variant="ghost"
                busy={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`contracts/${selected.id}/withdraw`, {
                      method: "POST",
                    });
                    await reload();
                    setSelected({ ...selected, status: "WITHDRAWN" });
                  }, "Agreement withdrawn")
                }
              >
                Withdraw
              </Button>
            )}
          </div>
          {!vendor && selected.status === "SENT" && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await run(async () => {
                  const signed = await api<Contract>(
                    `contracts/${selected.id}/sign`,
                    {
                      method: "POST",
                      body: json({
                        name: f.get("name"),
                        accepted: f.get("accepted") === "on",
                      }),
                    },
                  );
                  setSelected(signed);
                  await reload();
                }, "Your acknowledgement has been recorded");
              }}
            >
              <Field label={`Your full account name: ${user?.fullName}`}>
                <input name="name" required minLength={2} autoComplete="name" />
              </Field>
              <label className="check-field">
                <input type="checkbox" name="accepted" required />
                <span>
                  I have read this agreement and intend to acknowledge its terms
                  with my account name.
                </span>
              </label>
              <Button busy={busy}>
                <FileSignature size={17} />
                Acknowledge agreement
              </Button>
            </form>
          )}
        </Modal>
      )}
      {adding && (
        <Modal title="A thoughtful agreement" onClose={() => setAdding(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api("contracts", {
                    method: "POST",
                    body: json({
                      vendorId: businessId,
                      eventId: f.get("eventId"),
                      title: f.get("title"),
                      body: f.get("body"),
                      amountMinor: Math.round(Number(f.get("amount")) * 100),
                    }),
                  });
                  await reload();
                }, "Agreement sent to your client")
              )
                setAdding(false);
            }}
          >
            <Field label="Your business">
              <select
                value={businessId || ""}
                onChange={(e) => setBusiness(e.target.value)}
                required
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.businessName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Client celebration">
              <select name="eventId" required>
                <option value="">Choose a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Agreement title">
              <input
                name="title"
                minLength={3}
                maxLength={150}
                required
                placeholder="Wedding photography agreement"
              />
            </Field>
            <Field label="Reference amount (৳)">
              <input
                name="amount"
                type="number"
                min="0"
                max="20000000"
                required
              />
            </Field>
            <Field label="Scope, deliverables, dates & cancellation terms">
              <textarea
                name="body"
                minLength={30}
                maxLength={30000}
                rows={9}
                required
                placeholder="Describe the scope, deliverables, responsibilities, payment expectations, and cancellation terms agreed with your client."
              />
            </Field>
            <p className="helper-text">
              Publishing fixes this version of the text. Send a new agreement if
              terms change.
            </p>
            <Button busy={busy} disabled={!clients.length}>
              Send agreement
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
