"use client";
import Link from "next/link";
import {
  Armchair,
  Timer,
  QrCode,
  Globe,
  FileSignature,
  Receipt,
  Users,
  Zap,
  Palette,
  BarChart3,
  Heart,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import { useApp } from "@/lib/context";
import { PageHeading } from "@/components/ui";
const tools = [
  {
    url: "/seating",
    title: "Seating & floor plan",
    description:
      "Arrange tables, place guest groups, and keep every seat in balance.",
    icon: Armchair,
    tag: "DESIGN THE ROOM",
    color: "sage",
  },
  {
    url: "/run-sheet",
    title: "Celebration control room",
    description:
      "Minute-by-minute cues, team handoffs, and one clear live moment.",
    icon: Timer,
    tag: "RUN THE DAY",
    color: "rose",
  },
  {
    url: "/check-in",
    title: "Guest welcome desk",
    description:
      "QR invitations, camera check-in, and a real-time arrival journal.",
    icon: QrCode,
    tag: "WELCOME YOUR PEOPLE",
    color: "peach",
  },
  {
    url: "/website",
    title: "Your celebration website",
    description:
      "Your story, dates, private access, and a moderated little guestbook.",
    icon: Globe,
    tag: "SHARE YOUR STORY",
    color: "lavender",
  },
  {
    url: "/contracts",
    title: "Agreements & acknowledgements",
    description:
      "Fixed document versions, account signatures, and clear records.",
    icon: FileSignature,
    tag: "MAKE IT CLEAR",
    color: "rose",
  },
  {
    url: "/finance",
    title: "Invoices & payment plans",
    description:
      "Every balance, installment, and payment trail, thoughtfully together.",
    icon: Receipt,
    tag: "KEEP IT BALANCED",
    color: "sage",
  },
  {
    url: "/collaboration",
    title: "Your planning circle",
    description:
      "Invite editors or viewers with permissions and access deadlines.",
    icon: Users,
    tag: "PLAN TOGETHER",
    color: "lavender",
  },
  {
    url: "/automations",
    title: "Helpful little workflows",
    description:
      "Connect dates, budgets, and tasks to reminders that take the next step.",
    icon: Zap,
    tag: "MAKE PLANNING FLOW",
    color: "peach",
  },
  {
    url: "/inspiration",
    title: "Inspiration atelier",
    description:
      "Images, notes, and a palette that makes your celebration feel like you.",
    icon: Palette,
    tag: "COLLECT YOUR VISION",
    color: "sage",
  },
  {
    url: "/shortlist",
    title: "Your dream-team shortlist",
    description:
      "Save your favorites and compare services, prices, and capacity.",
    icon: Heart,
    tag: "FIND YOUR PEOPLE",
    color: "rose",
  },
  {
    url: "/insights",
    title: "Planning insights",
    description:
      "Guest responses, readiness, commitments, and a clear activity journal.",
    icon: BarChart3,
    tag: "SEE THE BIG PICTURE",
    color: "lavender",
  },
  {
    url: "/timeline",
    title: "Your celebration chapters",
    description:
      "Holud, wedding, reception, and all the days that make one story.",
    icon: CalendarDays,
    tag: "BRING THE DAYS TOGETHER",
    color: "peach",
  },
];
export default function Planning() {
  const { event } = useApp();
  const total = event?.tasks.length || 0,
    done = event?.tasks.filter((t) => t.done).length || 0;
  return (
    <>
      <PageHeading
        eyebrow="MORE THAN A PLAN. YOUR WHOLE CELEBRATION."
        title="The planning studio"
        description="A thoughtful command center for every person, promise, and beautifully timed moment."
      />
      <section className="planning-studio-hero">
        <div>
          <span className="hero-tag">
            YOUR CELEBRATION, IN EVERY LITTLE DETAIL
          </span>
          <h2>
            Big dreams.
            <br />
            <em>Thoughtfully orchestrated.</em>
          </h2>
          <p>
            From your first idea to the last warm goodbye. Your whole planning
            circle, working from the same beautiful picture.
          </p>
        </div>
        <div className="studio-hero-note">
          <CheckCircle2 size={26} />
          <strong>
            {done}
            <span> / {total}</span>
          </strong>
          <p>Little details, taken care of.</p>
          <div className="progress rose">
            <span style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <Link href="/checklist">
            Keep the good things moving <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <div className="studio-tool-grid">
        {tools.map((tool, i) => (
          <Link className="card studio-tool" key={tool.url} href={tool.url}>
            <div className="studio-tool-top">
              <span className={`stat-icon ${tool.color}`}>
                <tool.icon size={22} />
              </span>
              <span className="tool-number">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <span className="eyebrow">{tool.tag}</span>
            <h2>{tool.title}</h2>
            <p>{tool.description}</p>
            <span className="studio-tool-link">
              Open workspace <ArrowUpRight size={18} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
