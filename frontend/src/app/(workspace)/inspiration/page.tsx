"use client";
import { useState } from "react";
import { Plus, Trash2, Palette, ImageIcon, StickyNote } from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { useAction, useResource } from "@/lib/use-resource";
import { MoodItem } from "@/lib/advanced";
import { Button, Empty, Field, Modal, PageHeading } from "@/components/ui";
export default function Inspiration() {
  const { event } = useApp();
  const { data, reload } = useResource<MoodItem[]>(
    event ? `events/${event.id}/inspiration` : null,
    [],
  );
  const { busy, run } = useAction();
  const [adding, setAdding] = useState(false),
    [kind, setKind] = useState("IMAGE"),
    [filter, setFilter] = useState("All inspiration");
  if (!event)
    return <Empty title="Create your celebration to start collecting ideas" />;
  const tags = ["All inspiration", ...new Set(data.map((i) => i.tag))];
  return (
    <>
      <PageHeading
        eyebrow="COLLECT THE THINGS THAT FEEL LIKE YOU"
        title="Your inspiration atelier"
        description="A little color, a lovely setting, a note you don’t want to forget. Bring your vision together."
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus size={17} />
            Pin an idea
          </Button>
        }
      />
      <div className="tabs">
        {tags.map((t) => (
          <button
            key={t}
            className={t === filter ? "selected" : ""}
            onClick={() => setFilter(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mood-board">
        {data
          .filter((i) => filter === "All inspiration" || i.tag === filter)
          .map((i) => (
            <article
              className={`card mood-card mood-${i.kind.toLowerCase()}`}
              key={i.id}
            >
              {i.kind === "IMAGE" ? (
                <img src={i.value} alt={i.title} loading="lazy" />
              ) : i.kind === "COLOR" ? (
                <div
                  className="color-swatch"
                  style={{ backgroundColor: i.value }}
                >
                  <span>{i.value.toUpperCase()}</span>
                </div>
              ) : (
                <div className="mood-note">
                  <StickyNote size={24} />
                  <p>{i.value}</p>
                </div>
              )}
              <div className="mood-caption">
                <div>
                  <span className="eyebrow">{i.tag}</span>
                  <h3>{i.title}</h3>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remove inspiration ${i.title}`}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(`events/${event.id}/inspiration/${i.id}`, {
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
      {!data.length && (
        <div className="welcome-empty">
          <Palette size={46} />
          <h2>A beautiful celebration begins with a feeling.</h2>
          <p>
            Collect images, color palettes, and little notes. Your whole
            planning circle can see the same vision.
          </p>
          <Button onClick={() => setAdding(true)}>Add your first idea</Button>
        </div>
      )}
      {adding && (
        <Modal title="Something worth keeping" onClose={() => setAdding(false)}>
          <div className="tabs">
            {[
              ["IMAGE", "An image"],
              ["COLOR", "A color"],
              ["NOTE", "A little note"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={kind === v ? "selected" : ""}
                onClick={() => setKind(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await run(async () => {
                  await api(`events/${event.id}/inspiration`, {
                    method: "POST",
                    body: json({
                      kind,
                      title: f.get("title"),
                      tag: f.get("tag"),
                      value: f.get("value"),
                    }),
                  });
                  await reload();
                }, "A little inspiration, saved")
              )
                setAdding(false);
            }}
          >
            <Field label="Give this idea a name">
              <input name="title" required minLength={2} maxLength={100} />
            </Field>
            <Field label="Collection or theme">
              <input
                name="tag"
                defaultValue="Inspiration"
                required
                maxLength={50}
              />
            </Field>
            <Field
              label={
                kind === "IMAGE"
                  ? "HTTPS image URL"
                  : kind === "COLOR"
                    ? "Choose your color"
                    : "Your note"
              }
            >
              {kind === "NOTE" ? (
                <textarea
                  key={kind}
                  name="value"
                  required
                  minLength={2}
                  maxLength={3000}
                />
              ) : (
                <input
                  key={kind}
                  name="value"
                  type={kind === "COLOR" ? "color" : "url"}
                  required
                  defaultValue={kind === "COLOR" ? "#9f3e58" : undefined}
                  placeholder="https://…"
                />
              )}
            </Field>
            <Button busy={busy}>Pin to your board</Button>
          </form>
        </Modal>
      )}
    </>
  );
}
