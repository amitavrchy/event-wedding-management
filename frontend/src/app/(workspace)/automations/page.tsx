"use client";
import { useState } from "react";
import { Plus, Zap, Play, Trash2, ArrowRight } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { useAction, useResource } from "@/lib/use-resource";
import { Automation } from "@/lib/advanced";
import { dateLabel, statusLabel } from "@/lib/format";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
} from "@/components/ui";
type Rules = {
  rules: Automation[];
  runs: { id: string; ruleId: string; result: string; createdAt: string }[];
};
export default function Automations() {
  const { event, notify } = useApp();
  const { data, reload } = useResource<Rules>(
    event ? `events/${event.id}/automations` : null,
    { rules: [], runs: [] },
  );
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false);
  if (!event)
    return <Empty title="Create a celebration to make planning flow" />;
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE LESS TO REMEMBER"
        title="Let the little details flow"
        description="Choose a trigger, set a thoughtful action, and let your workspace take the next step."
        action={
          <div className="button-group">
            <Button
              variant="secondary"
              busy={busy}
              onClick={() =>
                void run(async () => {
                  const result = await api<{ executed: number }>(
                    `events/${event.id}/automations/run`,
                    { method: "POST" },
                  );
                  await reload();
                  notify(
                    `${result.executed} eligible automation${result.executed === 1 ? "" : "s"} ran`,
                  );
                })
              }
            >
              <Play size={16} />
              Check triggers now
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus size={17} />
              Create a workflow
            </Button>
          </div>
        }
      />
      <div className="automation-explainer">
        <span className="stat-icon rose">
          <Zap size={23} />
        </span>
        <div>
          <h2>Make room for the meaningful things.</h2>
          <p>
            Enabled workflows are checked every minute by the background worker.
            Each rule executes once, with a permanent run record, so retries
            don’t duplicate your task or reminder.
          </p>
        </div>
      </div>
      <div className="automation-grid">
        {data.rules.map((r) => (
          <article className="card automation-card" key={r.id}>
            <div className="document-card-top">
              <h2>{r.title}</h2>
              <button
                role="switch"
                aria-checked={r.enabled}
                aria-label={`Enable ${r.title}`}
                className={`toggle-switch ${r.enabled ? "on" : ""}`}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`events/${event.id}/automations/${r.id}`, {
                      method: "PATCH",
                      body: json({ enabled: !r.enabled }),
                    });
                    await reload();
                  })
                }
              >
                <span />
              </button>
            </div>
            <div className="automation-flow">
              <div>
                <span>WHEN</span>
                <strong>
                  {statusLabel(r.trigger)}
                  {r.trigger === "EVENT_APPROACHING"
                    ? ` · within ${r.daysBefore} days`
                    : ""}
                </strong>
              </div>
              <ArrowRight size={19} />
              <div>
                <span>THEN</span>
                <strong>
                  {r.action === "CREATE_TASK"
                    ? "Create a checklist task"
                    : "Send an in-app reminder"}
                </strong>
              </div>
            </div>
            <p className="automation-message">{r.message}</p>
            <div className="automation-footer">
              <Badge
                value={
                  data.runs.some((run) => run.ruleId === r.id)
                    ? "COMPLETED"
                    : r.enabled
                      ? "READY"
                      : "PAUSED"
                }
              />
              <button
                className="icon-button"
                aria-label={`Delete workflow ${r.title}`}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await api(`events/${event.id}/automations/${r.id}`, {
                      method: "DELETE",
                    });
                    await reload();
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!data.rules.length && (
        <Empty title="Your first helpful little workflow">
          Remind yourself before the day, catch an overdue task, or watch for an
          exceeded budget.
        </Empty>
      )}
      <section className="card section-gap">
        <div className="card-heading">
          <h2>The workflow journal</h2>
        </div>
        {data.runs.map((r) => (
          <div className="activity-row" key={r.id}>
            <span className="activity-dot" />
            <div>
              <strong>
                {data.rules.find((rule) => rule.id === r.ruleId)?.title ||
                  "Archived workflow"}
              </strong>
              <p>
                {statusLabel(r.result)} · {dateLabel(r.createdAt)}
              </p>
            </div>
            <Badge value="COMPLETED" />
          </div>
        ))}
        {!data.runs.length && (
          <Empty title="Your workflows are waiting for their moment" />
        )}
      </section>
      {adding && (
        <Modal
          title="A thoughtful little workflow"
          onClose={() => setAdding(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(`events/${event.id}/automations`, {
                    method: "POST",
                    body: json({
                      title: f.get("title"),
                      trigger: f.get("trigger"),
                      daysBefore: Number(f.get("daysBefore")),
                      action: f.get("action"),
                      message: f.get("message"),
                    }),
                  });
                  await reload();
                }, "Workflow enabled")
              )
                setAdding(false);
            }}
          >
            <Field label="Workflow name">
              <input
                name="title"
                required
                minLength={3}
                maxLength={100}
                placeholder="A week before our event"
              />
            </Field>
            <Field label="When this happens">
              <select name="trigger">
                <option value="EVENT_APPROACHING">
                  A celebration day is approaching
                </option>
                <option value="BUDGET_EXCEEDED">
                  Confirmed commitments exceed the budget
                </option>
                <option value="TASK_OVERDUE">
                  A checklist task becomes overdue
                </option>
              </select>
            </Field>
            <Field label="Days before the celebration (date trigger only)">
              <input
                name="daysBefore"
                type="number"
                min="0"
                max="365"
                defaultValue="7"
                required
              />
            </Field>
            <Field label="What should happen">
              <select name="action">
                <option value="NOTIFY">Send an in-app reminder</option>
                <option value="CREATE_TASK">Create a checklist task</option>
              </select>
            </Field>
            <Field label="Reminder or task text">
              <textarea
                name="message"
                required
                minLength={3}
                maxLength={200}
                placeholder="Confirm arrival times with our event professionals."
              />
            </Field>
            <Button busy={busy}>Create workflow</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
