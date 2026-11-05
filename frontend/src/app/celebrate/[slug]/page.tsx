"use client";
import { use, useEffect, useState } from "react";
import {
  Heart,
  CalendarDays,
  MapPin,
  ArrowDown,
  LockKeyhole,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { Day } from "@/lib/types";
import { dateLabel } from "@/lib/format";
import { downloadCalendar } from "@/lib/calendar";
import { Button, Field } from "@/components/ui";
type Site = {
  headline: string;
  story: string;
  coverUrl: string;
  theme: string;
  faqs: { question: string; answer: string }[];
  passwordRequired: boolean;
  guestbook: { id: string; name: string; message: string }[];
  event: { title: string; city: string; days: Day[] };
};
export default function CelebrationWebsite({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [site, setSite] = useState<Site | null>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false);
  useEffect(() => {
    void api<Site>(`public/sites/${slug}`)
      .then(setSite)
      .catch(() =>
        setError(
          "This celebration website is private, unpublished, or unavailable.",
        ),
      );
  }, [slug]);
  if (!site || site.passwordRequired)
    return (
      <main className="public-locked">
        <a className="brand" href="/">
          utsab<span>✳</span>
        </a>
        <LockKeyhole size={35} />
        <h1>A little celebration, just for you.</h1>
        <p>
          {site
            ? "Enter the password shared with your invitation."
            : error || "Opening a beautiful little story…"}
        </p>
        {site && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                const result = await api<Site>(`public/sites/${slug}/access`, {
                  method: "POST",
                  body: json({ password }),
                });
                if (result.passwordRequired)
                  setError("That password didn’t match. Please try again.");
                else setSite(result);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Celebration website password">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={72}
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button busy={busy}>Step inside</Button>
          </form>
        )}
      </main>
    );
  return (
    <main className={`public-celebration theme-${site.theme.toLowerCase()}`}>
      <header className="public-site-nav">
        <a className="brand" href="/">
          utsab<span>✳</span>
        </a>
        <nav>
          <a href="#our-story">Our story</a>
          <a href="#the-days">The celebrations</a>
          <a href="#guestbook">A little love</a>
        </nav>
      </header>
      <section
        className="public-site-hero"
        style={{
          backgroundImage: `linear-gradient(0deg,#211b2b88,#211b2b35),url("${site.coverUrl}")`,
        }}
      >
        <span className="public-eyebrow">TOGETHER WITH OUR FAMILIES</span>
        <h1>{site.headline}</h1>
        <p>{site.event.city}, Bangladesh</p>
        <a href="#our-story" className="public-scroll">
          <ArrowDown size={22} />
          <span>Our story begins here</span>
        </a>
      </section>
      <section className="public-story" id="our-story">
        <span className="public-flower">✳</span>
        <span className="eyebrow">EVERY LOVE HAS A LITTLE STORY</span>
        <h2>
          A thousand little moments.
          <br />
          One beautiful beginning.
        </h2>
        <p>{site.story || "We’re so glad you’re part of our next chapter."}</p>
      </section>
      <section className="public-days" id="the-days">
        <span className="eyebrow">SAVE A LITTLE ROOM FOR JOY</span>
        <h2>Days we’ll remember forever.</h2>
        <div>
          {site.event.days.map((d, i) => (
            <article key={d.id}>
              <span className="chapter-number">0{i + 1}</span>
              <h3>{d.name}</h3>
              <p>
                <CalendarDays size={17} />
                {dateLabel(d.startsAt)}
              </p>
              <p>
                {new Date(d.startsAt).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Dhaka",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                · Bangladesh time
              </p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${d.venueName || site.event.city} Bangladesh`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={16} />
                {d.venueName || site.event.city} ↗
              </a>
            </article>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() => downloadCalendar(site.event.title, site.event.days)}
        >
          <CalendarDays size={17} />
          Add these days to your calendar
        </Button>
        <p className="public-rsvp-note">
          Your personal RSVP link is on your invitation. It keeps your reply and
          guest allowance just for you.
        </p>
      </section>
      {site.faqs.length > 0 && (
        <section className="public-faq">
          <span className="eyebrow">
            THE LITTLE THINGS YOU MAY BE WONDERING
          </span>
          <h2>A few helpful answers.</h2>
          {site.faqs.map((f, i) => (
            <details key={i}>
              <summary>{f.question}</summary>
              <p>{f.answer}</p>
            </details>
          ))}
        </section>
      )}
      <section className="public-guestbook" id="guestbook">
        <Heart size={27} />
        <span className="eyebrow">WORDS WE’LL KEEP FOREVER</span>
        <h2>Leave a little love.</h2>
        <div className="public-wishes">
          {site.guestbook.map((entry) => (
            <blockquote key={entry.id}>
              <p>“{entry.message}”</p>
              <cite>{entry.name}</cite>
            </blockquote>
          ))}
        </div>
        {sent ? (
          <p className="guestbook-thanks" role="status">
            Thank you for your lovely words. They’ll appear after the hosts
            approve them.
          </p>
        ) : (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const f = new FormData(e.currentTarget);
              try {
                await api(`public/sites/${slug}/guestbook`, {
                  method: "POST",
                  body: json({
                    name: f.get("name"),
                    message: f.get("message"),
                    password: password || undefined,
                  }),
                });
                setSent(true);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Your name">
              <input name="name" required minLength={2} maxLength={100} />
            </Field>
            <Field label="A wish, a memory, a little love">
              <textarea
                name="message"
                required
                minLength={3}
                maxLength={1000}
              />
            </Field>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <Button busy={busy}>
              Send with love <Heart size={16} />
            </Button>
          </form>
        )}
      </section>
      <footer className="public-site-footer">
        <h2>Here’s to our next beautiful chapter.</h2>
        <p>{site.event.title}</p>
        <a className="brand" href="/">
          utsab<span>✳</span>
        </a>
      </footer>
    </main>
  );
}
