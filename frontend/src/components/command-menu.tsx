"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUpRight, Command } from "lucide-react";
import { Modal } from "./ui";
import { useApp } from "@/lib/context";
import { pathAllowed } from "@/lib/features";
const commands = [
  ["Overview", "Your celebration dashboard", "/dashboard"],
  ["Planning studio", "Every advanced planning tool, together", "/planning"],
  ["Find vendors", "Your local event professionals", "/vendors"],
  ["Bookings", "Held dates and confirmed professionals", "/bookings"],
  ["Seating studio", "Floor plan, tables, and guest groups", "/seating"],
  [
    "Celebration control room",
    "Run sheet, handoffs, and live cues",
    "/run-sheet",
  ],
  ["Guest welcome", "QR passes and arrival journal", "/check-in"],
  ["Celebration website", "Your story, dates, and guestbook", "/website"],
  ["Agreements", "Contracts and account acknowledgements", "/contracts"],
  ["Finance desk", "Invoices, balances, and installments", "/finance"],
  [
    "Planning circle",
    "Collaborators, invitations, and permissions",
    "/collaboration",
  ],
  ["Workflows", "Triggers, actions, and helpful reminders", "/automations"],
  [
    "Inspiration atelier",
    "Moodboard, images, notes, and color",
    "/inspiration",
  ],
  ["Your shortlist", "Favorite professionals and comparison", "/shortlist"],
  [
    "Insights",
    "Readiness, guest responses, and financial activity",
    "/insights",
  ],
  ["Guest list", "RSVPs, invitations, and meal choices", "/guests"],
  ["Business suite", "Vendor client pipeline and follow-ups", "/business"],
  [
    "Resource calendar",
    "Availability and recurring blackouts",
    "/availability",
  ],
  ["Event settings", "Budget, capacity, and RSVP deadline", "/settings"],
];
export function CommandMenu() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const router = useRouter();
  const { user, event, catalog } = useApp();
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((current) => !current);
        setSearch("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return (
    <>
      <button
        className="command-trigger"
        onClick={() => {
          setOpen(true);
          setSearch("");
        }}
        aria-label="Search workspace tools"
      >
        <Search size={17} />
        <span>Find your next step</span>
        <kbd>⌘ K</kbd>
      </button>
      {open && (
        <Modal
          title="A little shortcut to your next step"
          onClose={() => setOpen(false)}
        >
          <div className="search-field">
            <Search size={19} />
            <input
              aria-label="Search workspace commands"
              autoFocus
              placeholder="Try seating, a contract, your guest list…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="command-results">
            {commands
              .filter((c) => pathAllowed(c[2], user, event, catalog))
              .filter((c) =>
                `${c[0]} ${c[1]}`.toLowerCase().includes(search.toLowerCase()),
              )
              .map(([title, description, url]) => (
                <button
                  className="command-result"
                  key={url}
                  onClick={() => {
                    router.push(url);
                    setOpen(false);
                  }}
                >
                  <Command size={19} />
                  <div>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                  <ArrowUpRight size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
