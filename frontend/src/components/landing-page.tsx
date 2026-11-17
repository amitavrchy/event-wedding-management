"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Menu,
  X,
  Cake,
  Heart,
  BriefcaseBusiness,
  PartyPopper,
  CalendarDays,
  Users,
  Wallet,
  CheckCheck,
  Flower2,
  GraduationCap,
  Gift,
  Globe,
  MapPin,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { eventType } from "@/lib/event-types";
import { taka } from "@/lib/format";
const occasions = [
  {
    type: "WEDDING",
    name: "The start of forever",
    label: "Weddings",
    description: "Your people. Your traditions. Your beautiful beginning.",
    image: "/images/wedding.jpg",
    icon: Heart,
  },
  {
    type: "BIRTHDAY",
    name: "Another year of you",
    label: "Birthdays",
    description: "First candles, big milestones, and everything in between.",
    image: "/images/birthday.jpg",
    icon: Cake,
  },
  {
    type: "ANNIVERSARY",
    name: "Here’s to your story",
    label: "Anniversaries",
    description: "Celebrate the memories, and make a few more.",
    image: "/images/gathering.jpg",
    icon: Flower2,
  },
  {
    type: "CORPORATE",
    name: "Good people. Big ideas.",
    label: "Business events",
    description: "Team days, launches, and moments that move you forward.",
    image: "/images/corporate.jpg",
    icon: BriefcaseBusiness,
  },
];
const otherOccasions = [
  { type: "BABY_SHOWER", label: "Baby showers", icon: Gift },
  { type: "GRADUATION", label: "Graduations", icon: GraduationCap },
  { type: "REUNION", label: "Reunions", icon: Users },
  { type: "COMMUNITY", label: "Community gatherings", icon: Globe },
];
const faqs = [
  [
    "Is Utsab just for weddings?",
    "Every good gathering belongs here. Plan birthdays, anniversaries, engagements, baby showers, graduations, reunions, corporate events, conferences, community gatherings, and more. Each occasion comes with its own editable starter checklist and budget categories.",
  ],
  [
    "Do I need to book professionals straight away?",
    "You can start with your idea, a guest list, or a budget. Add dates, compare professionals, and hold availability whenever you’re ready. Your plans stay together as your event takes shape.",
  ],
  [
    "Can a planner or teammate help me?",
    "Yes. Event hosts can invite editors or viewers, and business owners can invite managers or viewers. Invitations are tied to an account email and have access deadlines.",
  ],
  [
    "Can I manage an event business here?",
    "Yes. Your business workspace includes a client pipeline, resource calendars, quotes, agreements, invoices, installment plans, team permissions, and earnings insights.",
  ],
  [
    "How do payments work?",
    "You can currently test advances, balances, installments, and refunds in sandbox mode without moving real money. Live gateway integration is required before taking real payments.",
  ],
];
export function LandingPage() {
  const { user } = useApp();
  const [selected, setSelected] = useState("BIRTHDAY"),
    [open, setOpen] = useState(false);
  const preview = eventType(selected);
  const workspace = user?.role === "VENDOR" ? "/business" : "/dashboard";
  function planHref(type = "GENERAL") {
    return user
      ? user.role === "VENDOR"
        ? "/business"
        : `/dashboard?new=${type}`
      : `/signup?event=${type}`;
  }
  return (
    <div className="landing">
      <a className="landing-skip" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-header">
        <Link href="/" className="brand" aria-label="Utsab home">
          utsab<span>✳</span>
        </Link>
        <nav
          aria-label="Main navigation"
          className={`landing-nav ${open ? "is-open" : ""}`}
        >
          <a href="#occasions" onClick={() => setOpen(false)}>
            Every occasion
          </a>
          <a href="#how-it-works" onClick={() => setOpen(false)}>
            How it works
          </a>
          <a href="#for-professionals" onClick={() => setOpen(false)}>
            For professionals <ArrowUpRight size={14} />
          </a>
          <Link
            className="landing-mobile-account"
            href={user ? workspace : "/login"}
          >
            {user ? "Your workspace" : "Sign in"}
          </Link>
        </nav>
        <div className="landing-header-actions">
          {user ? (
            <Link href={workspace} className="landing-signin">
              Your workspace <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Link href="/login" className="landing-signin">
              Sign in
            </Link>
          )}
          <Link href={planHref()} className="landing-button landing-primary">
            {user ? "Plan an event" : "Start planning"}
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <span />
              FOR ALL THE DAYS WORTH CELEBRATING
            </span>
            <h1>
              Every reason
              <br />
              to <em>celebrate.</em>
              <span>All in one place.</span>
            </h1>
            <p>
              Big birthdays. Beautiful beginnings. Another year together. Bring
              your people, your plans, and every little detail into one
              thoughtful space.
            </p>
            <div className="landing-hero-actions">
              <Link
                className="landing-button landing-primary"
                href={planHref(selected)}
              >
                Plan your{" "}
                {selected === "CORPORATE"
                  ? "next event"
                  : preview.label.toLowerCase()}{" "}
                <ArrowUpRight size={19} />
              </Link>
              <a className="landing-text-link" href="#occasions">
                Find your occasion <ArrowRight size={17} />
              </a>
            </div>
            <div className="landing-hero-notes">
              <span>
                <Check size={15} />
                Your day, your way
              </span>
              <span>
                <Check size={15} />
                Made for Bangladesh
              </span>
            </div>
            <div
              className="landing-occasion-switch"
              aria-label="Explore event previews"
            >
              {occasions.map((o) => (
                <button
                  key={o.type}
                  aria-pressed={selected === o.type}
                  onClick={() => setSelected(o.type)}
                >
                  <o.icon size={16} />
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="landing-hero-art">
            <span className="landing-orbit" aria-hidden="true">
              ✳
            </span>
            <div className="landing-hero-photo" key={selected}>
              <img
                src={preview.image}
                width={720}
                height={900}
                alt={
                  selected === "BIRTHDAY"
                    ? "Colorful confetti for a joyful birthday celebration"
                    : selected === "CORPORATE"
                      ? "A carefully prepared conference and event venue"
                      : selected === "WEDDING"
                        ? "Warm light and floral details for a wedding"
                        : "A beautifully arranged celebration setting"
                }
                fetchPriority="high"
              />
              <span className="landing-photo-label">
                <PartyPopper size={16} />
                {preview.short}
                <span>♡</span>
              </span>
            </div>
            <div className="landing-small-photo">
              <img
                src="/images/anniversary.jpg"
                width={320}
                height={360}
                alt="Friends sharing a happy moment outdoors"
              />
              <span>
                Good people.
                <br />
                Great memories.
              </span>
            </div>
            <div className="landing-preview-note">
              <span className="landing-note-icon">
                <CalendarDays size={19} />
              </span>
              <div>
                <strong>
                  {selected === "BIRTHDAY"
                    ? "Riya’s big 3–0"
                    : selected === "ANNIVERSARY"
                      ? "Ten beautiful years"
                      : selected === "CORPORATE"
                        ? "The team’s next chapter"
                        : "Ayesha & Raihan"}
                </strong>
                <span>{preview.label} · workspace preview</span>
              </div>
              <CheckCheck size={19} />
            </div>
            <span className="landing-art-caption">
              LESS OVERWHELM. MORE “REMEMBER WHEN?”
            </span>
          </div>
        </section>
        <div className="landing-ribbon">
          <span>A little less planning.</span>
          <span aria-hidden="true">✳</span>
          <strong>A lot more being there.</strong>
          <span aria-hidden="true">✳</span>
          <span>Every kind of together.</span>
        </div>
        <section className="landing-occasions landing-section" id="occasions">
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">
                SO MANY REASONS. ONE BEAUTIFUL PLACE.
              </span>
              <h2>
                Whatever brings
                <br />
                you <em>together.</em>
              </h2>
            </div>
            <p>
              Some days come once. Some deserve a celebration every year. Make
              room for all of them.
            </p>
          </div>
          <div className="landing-occasion-grid">
            {occasions.map((o, i) => (
              <Link
                key={o.type}
                href={planHref(o.type)}
                className={`landing-occasion-card occasion-${i}`}
              >
                <div className="landing-occasion-photo">
                  <img
                    src={o.image}
                    width={600}
                    height={650}
                    alt={
                      o.type === "BIRTHDAY"
                        ? "Bright celebratory confetti"
                        : o.type === "CORPORATE"
                          ? "A venue prepared for a business gathering"
                          : o.type === "WEDDING"
                            ? "Romantic wedding florals"
                            : "A warm gathering and dining setting"
                    }
                    loading="lazy"
                  />
                  <span>
                    <o.icon size={16} />
                    {o.label}
                  </span>
                </div>
                <div className="landing-occasion-copy">
                  <h3>{o.name}</h3>
                  <p>{o.description}</p>
                  <span>
                    Make it yours <ArrowUpRight size={18} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <div className="landing-other-occasions">
            <span>AND EVERY LITTLE MILESTONE IN BETWEEN</span>
            <div>
              {otherOccasions.map((o) => (
                <Link key={o.type} href={planHref(o.type)}>
                  <o.icon size={18} />
                  {o.label}
                  <ArrowUpRight size={15} />
                </Link>
              ))}
              <Link href={planHref("GENERAL")}>
                <PartyPopper size={18} />
                Something else?
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </div>
        </section>
        <section
          className="landing-together landing-section"
          id="the-workspace"
        >
          <div className="landing-workspace-demo">
            <div className="landing-demo-top">
              <span className="brand">
                utsab<span>✳</span>
              </span>
              <span>WORKSPACE PREVIEW</span>
              <i />
              <i />
              <i />
            </div>
            <div className="landing-demo-body">
              <span className="landing-eyebrow">
                A LITTLE CELEBRATION, COMING TOGETHER
              </span>
              <h3>
                Riya’s big 3–0 <span>✧</span>
              </h3>
              <p>Birthday celebration · an example plan</p>
              <div className="landing-demo-metrics">
                <div>
                  <Wallet size={17} />
                  <span>Planned budget</span>
                  <strong>{taka(10000000)}</strong>
                </div>
                <div>
                  <Users size={17} />
                  <span>Guest capacity</span>
                  <strong>
                    50 <small>favorite people</small>
                  </strong>
                </div>
              </div>
              <div className="landing-demo-checklist">
                <div>
                  <span>
                    <Check size={13} />
                  </span>
                  <p>Find a little place for a big night</p>
                  <strong>Done</strong>
                </div>
                <div>
                  <span>
                    <Check size={13} />
                  </span>
                  <p>Choose the birthday cake</p>
                  <strong>Done</strong>
                </div>
                <div>
                  <span />
                  <p>Send a little love to your guest list</p>
                  <strong>Next up</strong>
                </div>
              </div>
              <div className="landing-demo-footer">
                <Sparkles size={16} />A few good plans. A whole lot of
                possibility.
              </div>
            </div>
            <div className="landing-demo-float">
              <Users size={22} />
              <span>
                Your people.
                <br />
                <strong>All in the same picture.</strong>
              </span>
            </div>
          </div>
          <div className="landing-together-copy">
            <span className="landing-eyebrow">
              EVERY DETAIL, A LITTLE LIGHTER
            </span>
            <h2>
              Your kind
              <br />
              of <em>organized.</em>
            </h2>
            <p>
              A hundred little details shouldn’t take you away from the reason
              you’re celebrating. Keep everything close, and let the good
              moments happen.
            </p>
            <div className="landing-feature-list">
              <div>
                <span>
                  <Heart size={21} />
                </span>
                <section>
                  <h3>Find your kind of people.</h3>
                  <p>
                    Discover local professionals, compare your favorites, and
                    hold the dates that matter.
                  </p>
                </section>
              </div>
              <div>
                <span>
                  <Wallet size={21} />
                </span>
                <section>
                  <h3>Give every detail a little room.</h3>
                  <p>
                    Keep budgets, bookings, agreements, and payment milestones
                    beautifully connected.
                  </p>
                </section>
              </div>
              <div>
                <span>
                  <Users size={21} />
                </span>
                <section>
                  <h3>Bring everyone into the moment.</h3>
                  <p>
                    Personal RSVPs, seating plans, guest passes, and a team that
                    knows what comes next.
                  </p>
                </section>
              </div>
            </div>
            <Link href={planHref()} className="landing-text-link">
              Meet your next planning space <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section className="landing-how landing-section" id="how-it-works">
          <div className="landing-center-heading">
            <span className="landing-eyebrow">
              FROM “WHAT IF” TO “WHAT A DAY”
            </span>
            <h2>
              A little plan.
              <br />A <em>beautiful</em> beginning.
            </h2>
          </div>
          <div className="landing-steps">
            {[
              {
                number: "01",
                title: "Start with your moment.",
                copy: "A birthday, a business day, or a little “just because.” Choose your occasion and a starter plan that feels like you.",
                icon: PartyPopper,
              },
              {
                number: "02",
                title: "Bring the details together.",
                copy: "Set a budget, gather your guest list, find your professionals, and invite a little help from your planning circle.",
                icon: CheckCheck,
              },
              {
                number: "03",
                title: "Make room for being there.",
                copy: "Keep the run sheet, seating, and guest welcome together—so you can spend more of the day in the moment.",
                icon: Heart,
              },
            ].map((step) => (
              <article key={step.number}>
                <div>
                  <span>{step.number}</span>
                  <step.icon size={25} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-business" id="for-professionals">
          <div className="landing-business-copy">
            <span className="landing-eyebrow">
              FOR THE PEOPLE BEHIND THE GOOD DAYS
            </span>
            <h2>
              Your craft.
              <br />
              Their celebration.
              <br />
              <em>One connected business.</em>
            </h2>
            <p>
              Venues, caterers, creatives, and event teams: turn an inquiry into
              a thoughtfully run occasion, with the business details taken care
              of along the way.
            </p>
            <div className="landing-business-features">
              <span>
                <Check size={15} />
                Client pipeline & follow-ups
              </span>
              <span>
                <Check size={15} />
                Resource calendars & availability
              </span>
              <span>
                <Check size={15} />
                Quotes, agreements & invoices
              </span>
              <span>
                <Check size={15} />
                Team access & earnings insights
              </span>
            </div>
            <Link
              className="landing-button landing-light"
              href={
                user?.role === "VENDOR" ? "/business" : "/signup?role=VENDOR"
              }
            >
              Build your event business <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="landing-business-art">
            <div className="landing-business-photo">
              <img
                src="/images/gathering.jpg"
                width={700}
                height={600}
                alt="An event venue thoughtfully prepared for guests"
                loading="lazy"
              />
            </div>
            <div className="landing-pipeline">
              <div>
                <span className="landing-pipeline-dot" />A FEW GOOD THINGS IN
                THE PIPELINE<span>↗</span>
              </div>
              <section>
                <div>
                  <small>NEW INQUIRY</small>
                  <strong>A birthday to remember</strong>
                  <span>Start with a little hello</span>
                </div>
                <ChevronRight size={19} />
                <div>
                  <small>PROPOSAL</small>
                  <strong>A company celebration</strong>
                  <span>The details, coming together</span>
                </div>
              </section>
              <p>Illustrative business workspace</p>
            </div>
          </div>
        </section>
        <section className="landing-faq landing-section" id="questions">
          <div>
            <span className="landing-eyebrow">
              A FEW THINGS YOU MIGHT BE WONDERING
            </span>
            <h2>
              A little
              <br />
              <em>clarity.</em>
            </h2>
            <p>Room for your questions, too.</p>
          </div>
          <div className="landing-faq-items">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <PlusMark />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <span aria-hidden="true">✳</span>
          <div>
            <span className="landing-eyebrow">
              YOUR NEXT GREAT MEMORY STARTS SOMEWHERE
            </span>
            <h2>
              Let’s make it
              <br />
              <em>feel like you.</em>
            </h2>
            <p>Whatever you’re celebrating, we’re glad you’re here.</p>
            <Link href={planHref()} className="landing-button landing-primary">
              Start your next celebration <ArrowUpRight size={19} />
            </Link>
          </div>
          <span aria-hidden="true">✳</span>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link className="brand" href="/">
            utsab<span>✳</span>
          </Link>
          <p>
            Big moments. Little details.
            <br />
            Beautifully together.
          </p>
          <span>Made with care for Bangladesh.</span>
        </div>
        <nav aria-label="Explore Utsab">
          <strong>A little exploring</strong>
          <a href="#occasions">Every occasion</a>
          <a href="#the-workspace">Your planning space</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <nav aria-label="Your next step">
          <strong>Your next chapter</strong>
          <Link href={planHref()}>Plan an event</Link>
          <Link href="/signup?role=VENDOR">For event professionals</Link>
          <Link href={user ? workspace : "/login"}>Your workspace</Link>
        </nav>
        <nav aria-label="Policies">
          <strong>Policies</strong>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refund-policy">Refunds</Link>
        </nav>
        <div className="landing-footer-note">
          <span>EVERY KIND OF TOGETHER.</span>
          <p>
            A birthday. A beginning.
            <br />A room full of your people.
          </p>
          <Heart size={20} />
        </div>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Utsab</span>
          <a href="#landing-main">Back to the good things ↑</a>
        </div>
      </footer>
    </div>
  );
}
function PlusMark() {
  return (
    <span className="faq-plus" aria-hidden="true">
      +
    </span>
  );
}
