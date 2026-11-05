"use client";
import { useState } from "react";
import { Check, Plus, ListChecks } from "lucide-react";
import { useApp } from "@/lib/context";
import { api, json } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
export default function Checklist() {
  const { event, refresh, notify } = useApp();
  const [adding, setAdding] = useState(false),
    [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState("");
  if (!event)
    return <Empty title="Create a celebration and make a little plan" />;
  const tasks = event.tasks || [],
    done = tasks.filter((t) => t.done).length;
  return (
    <>
      <PageHeading
        eyebrow="ONE LOVELY DETAIL AT A TIME"
        title="A little closer to your big day"
        description="Make a plan, take a breath, and enjoy checking things off."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add a task
          </Button>
        }
      />
      <section className="checklist-banner">
        <ListChecks size={34} />
        <div>
          <h2>
            {done} of {tasks.length} little details, taken care of.
          </h2>
          <p>Progress looks good on you.</p>
          <div className="progress rose">
            <span
              style={{
                width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <strong>
          {tasks.length ? Math.round((done / tasks.length) * 100) : 0}%
        </strong>
      </section>
      <div className="tabs">
        {[
          ["all", "Every detail"],
          ["todo", "Still to do"],
          ["done", "Beautifully done"],
        ].map(([v, l]) => (
          <button
            className={v === filter ? "selected" : ""}
            key={v}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <section className="card full-task-list">
        {tasks
          .filter(
            (t) => filter === "all" || (filter === "done" ? t.done : !t.done),
          )
          .map((t) => (
            <button
              disabled={busy === t.id}
              className={`task-row ${t.done ? "done" : ""}`}
              key={t.id}
              onClick={async () => {
                setBusy(t.id);
                try {
                  await api(`events/${event.id}/tasks/${t.id}`, {
                    method: "PATCH",
                    body: json({ done: !t.done }),
                  });
                  await refresh();
                } catch (e) {
                  notify((e as Error).message, true);
                } finally {
                  setBusy("");
                }
              }}
            >
              <span className="task-check">
                {t.done && <Check size={15} />}
              </span>
              <span className="task-copy">
                <strong>{t.title}</strong>
                <small>
                  {t.dueAt
                    ? `By ${dateLabel(t.dueAt)}`
                    : "One step at your own pace"}
                </small>
              </span>
              <span className={`task-status ${t.done ? "finished" : ""}`}>
                {t.done ? "Done" : "To do"}
              </span>
            </button>
          ))}
        {!tasks.length && (
          <Empty title="Start with one small step">
            Add your first task and make room for the good stuff.
          </Empty>
        )}
      </section>
      {adding && (
        <Modal title="One little detail" onClose={() => setAdding(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("new");
              const f = new FormData(e.currentTarget);
              try {
                await api(`events/${event.id}/tasks`, {
                  method: "POST",
                  body: json({
                    title: f.get("title"),
                    dueAt: f.get("dueAt")
                      ? `${f.get("dueAt")}T12:00:00+06:00`
                      : undefined,
                  }),
                });
                await refresh();
                setAdding(false);
                notify("Added to your plan");
              } catch (e) {
                notify((e as Error).message, true);
              } finally {
                setBusy("");
              }
            }}
          >
            <Field label="What needs a little love?">
              <input
                name="title"
                required
                minLength={2}
                maxLength={200}
                placeholder="Choose the wedding invitations"
              />
            </Field>
            <Field label="Due date (optional)">
              <input type="date" name="dueAt" />
            </Field>
            <Button busy={busy === "new"}>Add to checklist</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
