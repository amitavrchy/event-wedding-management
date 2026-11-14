"use client";
import Link from "next/link";
import { useState } from "react";
import {
  Plus,
  Briefcase,
  CalendarDays,
  ArrowUpRight,
  Clock,
  Mail,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { useBusiness } from "@/lib/use-business";
import { InquiryInbox } from "@/components/inquiry-inbox";
import { useAction, useResource } from "@/lib/use-resource";
import { Lead } from "@/lib/advanced";
import { taka, dateLabel, localDateToISO } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
const stages = ["NEW", "QUALIFIED", "PROPOSAL", "WON", "LOST"];
export default function Business() {
  const { business, businesses, choose } = useBusiness();
  const { data, reload } = useResource<Lead[]>(
    business ? `vendors/${business.id}/leads` : null,
    [],
  );
  const [adding, setAdding] = useState(false),
    [editing, setEditing] = useState<Lead | null>(null);
  const { busy, run } = useAction();
  async function stage(lead: Lead, value: string) {
    await run(async () => {
      await api(`vendors/${business!.id}/leads/${lead.id}`, {
        method: "PATCH",
        body: json({ stage: value }),
      });
      await reload();
    }, "Pipeline updated");
  }
  if (!business)
    return (
      <>
        <PageHeading
          eyebrow="YOUR CRAFT. YOUR NEXT CHAPTER."
          title="The business suite"
          description="A professional workspace for the people behind unforgettable celebrations."
        />
        <Empty title="Add your first business to open your pipeline">
          <Link href="/studio">Apply in the vendor studio →</Link>
        </Empty>
      </>
    );
  const open = data.filter((l) => !["WON", "LOST"].includes(l.stage));
  return (
    <>
      <PageHeading
        eyebrow="THOUGHTFUL SERVICE. A GROWING BUSINESS."
        title="Your next beautiful booking"
        description="Keep every inquiry, follow-up, and opportunity moving with a visual client pipeline."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={17} />
            New inquiry
          </Button>
        }
      />
      <InquiryInbox vendorId={business.id} />
      <div className="business-switch">
        <Field label="Your business">
          <select value={business.id} onChange={(e) => choose(e.target.value)}>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </select>
        </Field>
        <div className="button-group">
          <Link href="/availability" className="button secondary">
            <CalendarDays size={17} />
            Resource calendar
          </Link>
          <Link href="/insights" className="button secondary">
            Business insights <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
      <div className="advanced-metrics">
        <div>
          <Briefcase />
          <strong>{open.length}</strong>
          <span>Open opportunities</span>
        </div>
        <div>
          <strong>
            {taka(
              open.reduce((s, l) => s + l.estimatedMinor, 0),
              true,
            )}
          </strong>
          <span>Open pipeline</span>
        </div>
        <div>
          <strong>
            {data.length
              ? Math.round(
                  (data.filter((l) => l.stage === "WON").length / data.length) *
                    100,
                )
              : 0}
            %
          </strong>
          <span>Inquiry win rate</span>
        </div>
        <div>
          <Clock />
          <strong>
            {
              open.filter(
                (l) => l.followUpAt && new Date(l.followUpAt) < new Date(),
              ).length
            }
          </strong>
          <span>Follow-ups due</span>
        </div>
      </div>
      <div className="pipeline-board">
        {stages.map((s) => (
          <section
            className={`pipeline-column stage-${s.toLowerCase()}`}
            key={s}
            aria-label={`${s.toLowerCase()} pipeline column`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const lead = data.find(
                (l) => l.id === e.dataTransfer.getData("text/plain"),
              );
              if (lead) void stage(lead, s);
            }}
          >
            <div className="pipeline-heading">
              <span>{s.toLowerCase()}</span>
              <strong>{data.filter((l) => l.stage === s).length}</strong>
            </div>
            <div className="pipeline-column-value">
              {taka(
                data
                  .filter((l) => l.stage === s)
                  .reduce((sum, l) => sum + l.estimatedMinor, 0),
              )}
            </div>
            {data
              .filter((l) => l.stage === s)
              .map((l) => (
                <article
                  className="lead-card"
                  key={l.id}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", l.id)
                  }
                >
                  <button className="lead-open" onClick={() => setEditing(l)}>
                    <h3>{l.name}</h3>
                    <strong>{taka(l.estimatedMinor)}</strong>
                    {l.eventDate && (
                      <p>
                        <CalendarDays size={14} />
                        {dateLabel(l.eventDate)}
                      </p>
                    )}
                    {l.email && (
                      <p>
                        <Mail size={14} />
                        <span title={l.email}>{l.email}</span>
                      </p>
                    )}
                    {l.followUpAt && (
                      <span
                        className={
                          new Date(l.followUpAt) < new Date()
                            ? "lead-followup overdue"
                            : "lead-followup"
                        }
                      >
                        Follow up{" "}
                        {dateLabel(l.followUpAt, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                  </button>
                  <select
                    aria-label={`Stage for ${l.name}`}
                    value={l.stage}
                    disabled={busy}
                    onChange={(e) => void stage(l, e.target.value)}
                  >
                    {stages.map((value) => (
                      <option key={value} value={value}>
                        {value.toLowerCase()}
                      </option>
                    ))}
                  </select>
                </article>
              ))}
            {!data.some((l) => l.stage === s) && (
              <p className="pipeline-empty">Room for your next opportunity.</p>
            )}
          </section>
        ))}
      </div>
      <div className="business-tools">
        <Link href="/contracts">
          <span>01</span>
          <h3>Client agreements</h3>
          <p>Send clear terms and track acknowledgements.</p>
          <ArrowUpRight />
        </Link>
        <Link href="/finance">
          <span>02</span>
          <h3>Invoices & balances</h3>
          <p>See capture history and client payment plans.</p>
          <ArrowUpRight />
        </Link>
        <Link href="/collaboration">
          <span>03</span>
          <h3>Your professional team</h3>
          <p>Invite managers with time-limited access.</p>
          <ArrowUpRight />
        </Link>
      </div>
      {(adding || editing) && (
        <Modal
          title={
            editing
              ? "A little care for this opportunity"
              : "A new beginning for your business"
          }
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(
                    `vendors/${business.id}/leads${editing ? `/${editing.id}` : ""}`,
                    {
                      method: editing ? "PATCH" : "POST",
                      body: json({
                        name: f.get("name"),
                        email: f.get("email") || undefined,
                        estimatedMinor: Math.round(
                          Number(f.get("estimate")) * 100,
                        ),
                        eventDate: f.get("eventDate")
                          ? `${f.get("eventDate")}T18:00:00+06:00`
                          : undefined,
                        followUpAt: f.get("followUp")
                          ? localDateToISO(String(f.get("followUp")))
                          : undefined,
                        notes: f.get("notes"),
                      }),
                    },
                  );
                  await reload();
                }, "Inquiry saved")
              ) {
                setAdding(false);
                setEditing(null);
              }
            }}
          >
            <Field label="Client or inquiry name">
              <input
                name="name"
                defaultValue={editing?.name}
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label="Email">
              <input name="email" type="email" defaultValue={editing?.email} />
            </Field>
            <Field label="Estimated value (৳)">
              <input
                name="estimate"
                type="number"
                min="0"
                max="20000000"
                step="0.01"
                defaultValue={(editing?.estimatedMinor || 0) / 100}
                required
              />
            </Field>
            <div className="form-row">
              <Field label="Celebration date">
                <input
                  name="eventDate"
                  type="date"
                  defaultValue={editing?.eventDate?.slice(0, 10)}
                />
              </Field>
              <Field label="Next follow-up (Asia/Dhaka)">
                <input
                  name="followUp"
                  type="datetime-local"
                  defaultValue={
                    editing?.followUpAt
                      ? new Date(+new Date(editing.followUpAt) + 21600000)
                          .toISOString()
                          .slice(0, 16)
                      : undefined
                  }
                />
              </Field>
            </div>
            <Field label="Notes and preferences">
              <textarea
                name="notes"
                defaultValue={editing?.notes}
                maxLength={5000}
              />
            </Field>
            <Button busy={busy}>Save inquiry</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
