"use client";
import { useEffect, useState } from "react";
import {
  Globe,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  EyeOff,
  Copy,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { useApp } from "@/lib/context";
import { useAction, useResource } from "@/lib/use-resource";
import { Website } from "@/lib/advanced";
import { Badge, Button, Empty, Field, PageHeading } from "@/components/ui";
export default function WebsiteEditor() {
  const { event, notify } = useApp();
  const { data, reload } = useResource<Website | null>(
    event ? `events/${event.id}/website` : null,
    null,
  );
  const { busy, run } = useAction();
  const [headline, setHeadline] = useState(""),
    [story, setStory] = useState(""),
    [cover, setCover] = useState(
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=85",
    ),
    [theme, setTheme] = useState("ROSE"),
    [slug, setSlug] = useState(""),
    [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  useEffect(() => {
    if (data) {
      setHeadline(data.headline);
      setStory(data.story);
      setCover(data.coverUrl);
      setTheme(data.theme);
      setSlug(data.slug);
      setFaqs(data.faqs);
    } else if (event) {
      setHeadline(`The wedding of ${event.title}`);
      setStory("");
      setSlug(
        event.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
      setFaqs([]);
    }
  }, [data?.id, data?.version, event?.id]);
  if (!event) return <Empty title="Create a celebration to tell your story" />;
  return (
    <>
      <PageHeading
        eyebrow="YOUR STORY, BEAUTIFULLY SHARED"
        title="Your celebration website"
        description="A personal home for your story, dates, answers, and a little love from your favorite people."
        action={
          data ? (
            <div className="button-group">
              <Badge value={data.published ? "PUBLISHED" : "DRAFT"} />
              {data.published && (
                <a
                  className="button secondary"
                  href={`/celebrate/${data.slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={17} />
                  Open website
                </a>
              )}
            </div>
          ) : undefined
        }
      />
      <div className="website-editor">
        <section className="card website-form">
          <form
            className="form-stack padded"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form),
                submitter = (e.nativeEvent as SubmitEvent)
                  .submitter as HTMLButtonElement | null;
              await run(
                async () => {
                  await api(`events/${event.id}/website`, {
                    method: "PUT",
                    body: json({
                      slug,
                      headline,
                      story,
                      coverUrl: cover,
                      theme,
                      faqs,
                      published: submitter?.value === "publish",
                      version: data?.version,
                      password: f.get("password") || undefined,
                      clearPassword: f.get("clearPassword") === "on",
                    }),
                  });
                  await reload();
                  const password = form.elements.namedItem(
                    "password",
                  ) as HTMLInputElement | null;
                  if (password) password.value = "";
                  const clear = form.elements.namedItem(
                    "clearPassword",
                  ) as HTMLInputElement | null;
                  if (clear) clear.checked = false;
                },
                submitter?.value === "publish"
                  ? "Your celebration website is published"
                  : "Your website is saved privately",
              );
            }}
          >
            <Field label="Website address">
              <div className="slug-input">
                <span>/celebrate/</span>
                <input
                  aria-label="Website slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  minLength={3}
                  maxLength={60}
                  required
                />
              </div>
            </Field>
            <Field label="Your headline">
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                minLength={3}
                maxLength={150}
                required
              />
            </Field>
            <Field label="Your story">
              <textarea
                value={story}
                onChange={(e) => setStory(e.target.value)}
                rows={7}
                maxLength={8000}
                placeholder="How it all began, the things you love, and what this celebration means to you…"
              />
            </Field>
            <Field label="Cover image URL (HTTPS)">
              <input
                type="url"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                required
              />
            </Field>
            <Field label="Choose your atmosphere">
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="ROSE">Rose · warm and romantic</option>
                <option value="SAGE">Sage · grounded and natural</option>
                <option value="MIDNIGHT">
                  Midnight · elegant and intimate
                </option>
              </select>
            </Field>
            <div className="faq-editor">
              <div className="faq-editor-heading">
                <h3>A little helpful information</h3>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={faqs.length >= 20}
                  onClick={() =>
                    setFaqs((current) => [
                      ...current,
                      { question: "", answer: "" },
                    ])
                  }
                >
                  <Plus size={16} />
                  Add an answer
                </Button>
              </div>
              {faqs.map((faq, i) => (
                <div className="faq-editor-row" key={i}>
                  <Field label={`Question ${i + 1}`}>
                    <input
                      value={faq.question}
                      required
                      minLength={2}
                      maxLength={200}
                      onChange={(e) =>
                        setFaqs((current) =>
                          current.map((v, n) =>
                            n === i ? { ...v, question: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Your answer">
                    <textarea
                      value={faq.answer}
                      required
                      minLength={2}
                      maxLength={1000}
                      onChange={(e) =>
                        setFaqs((current) =>
                          current.map((v, n) =>
                            n === i ? { ...v, answer: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      setFaqs((current) => current.filter((_, n) => n !== i))
                    }
                  >
                    <Trash2 size={15} />
                    Remove this answer
                  </button>
                </div>
              ))}
            </div>
            <Field
              label={
                data?.passwordProtected
                  ? "Replace website password (optional)"
                  : "Optional guest website password"
              }
            >
              <input
                name="password"
                type="password"
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                placeholder="At least 6 characters, or leave empty"
              />
            </Field>
            {data?.passwordProtected && (
              <label className="check-field">
                <input type="checkbox" name="clearPassword" />
                Remove the existing website password
              </label>
            )}
            <div className="button-group">
              <Button busy={busy} name="action" value="publish">
                <Globe size={17} />
                {data?.published
                  ? "Update published website"
                  : "Publish website"}
              </Button>
              <Button
                busy={busy}
                variant="secondary"
                name="action"
                value="private"
              >
                <EyeOff size={17} />
                Save as private
              </Button>
            </div>
          </form>
        </section>
        <aside className={`website-preview theme-${theme.toLowerCase()}`}>
          <div className="preview-chrome">
            <span />
            <span />
            <span />
            <small>YOUR STORY, A FIRST LOOK</small>
          </div>
          <div
            className="preview-hero"
            style={{
              backgroundImage: `linear-gradient(0deg,#231e2b80,#231e2b10),url("${cover}")`,
            }}
          >
            <span>TOGETHER IS A BEAUTIFUL PLACE TO BE</span>
            <h2>{headline}</h2>
            <p>{event.city}, Bangladesh</p>
          </div>
          <div className="preview-story">
            <span>OUR LITTLE STORY</span>
            <p>{story || "Your beautiful story will find its home here."}</p>
            <div className="preview-days">
              {event.days.map((d) => (
                <div key={d.id}>
                  <strong>{d.name}</strong>
                  <span>
                    {new Date(d.startsAt).toLocaleDateString("en-GB", {
                      timeZone: "Asia/Dhaka",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <section className="card section-gap">
        <div className="card-heading">
          <div>
            <h2>A little love from your people</h2>
            <p>Guestbook messages are private until you approve them.</p>
          </div>
        </div>
        {data?.guestbook.map((entry) => (
          <div className="guestbook-review" key={entry.id}>
            <div>
              <h3>{entry.name}</h3>
              <p>{entry.message}</p>
            </div>
            <Badge value={entry.approved ? "APPROVED" : "PENDING"} />
            <Button
              variant="secondary"
              busy={busy}
              onClick={() =>
                void run(async () => {
                  await api(
                    `events/${event.id}/website/guestbook/${entry.id}`,
                    {
                      method: "PATCH",
                      body: json({ approved: !entry.approved }),
                    },
                  );
                  await reload();
                }, "Guestbook moderation saved")
              }
            >
              {entry.approved ? "Hide" : "Approve"}
            </Button>
            <button
              className="icon-button"
              aria-label={`Delete message by ${entry.name}`}
              onClick={() =>
                void run(async () => {
                  await api(
                    `events/${event.id}/website/guestbook/${entry.id}`,
                    { method: "DELETE" },
                  );
                  await reload();
                })
              }
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {!data?.guestbook.length && (
          <Empty title="Your guestbook is waiting for a little love" />
        )}
      </section>
    </>
  );
}
