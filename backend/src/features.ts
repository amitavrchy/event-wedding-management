import type { EventType } from "./event-templates";

/**
 * Occasion-driven workspace. Each event shows only the tools that fit its
 * occasion; hosts can switch extra tools on (or hide defaults) in settings.
 * Web and mobile both read this catalogue from GET /api/features.
 */
export const featureGroups = [
  { key: "plan", label: "Plan", labelBn: "পরিকল্পনা" },
  { key: "people", label: "Guests", labelBn: "অতিথি" },
  { key: "vendors", label: "Vendors", labelBn: "ভেন্ডর" },
  { key: "dayOf", label: "On the day", labelBn: "অনুষ্ঠানের দিন" },
  { key: "share", label: "Share", labelBn: "শেয়ার" },
  { key: "team", label: "Team", labelBn: "টিম" },
] as const;
type Group = (typeof featureGroups)[number]["key"];

type Feature = {
  key: string;
  group: Group;
  label: string;
  labelBn: string;
  description: string;
  /** Web route; mobile maps the key to its own screen. */
  path: string;
  /** Core tools are always on and cannot be hidden. */
  core?: boolean;
};

export const featureCatalog = [
  { key: "checklist", group: "plan", label: "Checklist", labelBn: "চেকলিস্ট", description: "Tasks with due dates and owners", path: "/checklist", core: true },
  { key: "budget", group: "plan", label: "Budget", labelBn: "বাজেট", description: "Planned, committed and spent", path: "/budget", core: true },
  { key: "timeline", group: "plan", label: "Event days", labelBn: "অনুষ্ঠানের দিনগুলো", description: "Multi-day schedule (Holud, Biye, Bou-bhat…)", path: "/timeline" },
  { key: "datePlanner", group: "plan", label: "Date planner", labelBn: "তারিখ পরিকল্পনা", description: "Holidays, Ramadan/Eid and vendor availability", path: "/date-planner" },
  { key: "costSplit", group: "plan", label: "Family cost split", labelBn: "খরচ ভাগাভাগি", description: "Share costs between the two families", path: "/cost-split" },
  { key: "gifts", group: "plan", label: "Gift register", labelBn: "উপহার খাতা", description: "Record gifts and salami, track thank-yous", path: "/gifts" },
  { key: "inspiration", group: "plan", label: "Inspiration", labelBn: "অনুপ্রেরণা", description: "Mood board, colours and ideas", path: "/inspiration" },

  { key: "guests", group: "people", label: "Guest list", labelBn: "অতিথি তালিকা", description: "Guests, RSVP and import", path: "/guests", core: true },
  { key: "sides", group: "people", label: "Bride & groom sides", labelBn: "বর ও কনে পক্ষ", description: "Separate guest quotas and lists per family", path: "/guests?view=sides" },
  { key: "households", group: "people", label: "Family invitations", labelBn: "পরিবারভিত্তিক দাওয়াত", description: "One invitation and RSVP per household", path: "/guests?view=households" },
  { key: "invitations", group: "people", label: "Invitation cards", labelBn: "দাওয়াত কার্ড", description: "Bangla/English cards shared on WhatsApp", path: "/invitations" },
  { key: "seating", group: "people", label: "Seating", labelBn: "বসার ব্যবস্থা", description: "Tables and seat assignment", path: "/seating" },
  { key: "logistics", group: "people", label: "Guest travel & stay", labelBn: "অতিথির যাতায়াত ও থাকা", description: "Rooms and transport for outstation guests", path: "/logistics" },
  { key: "checkIn", group: "people", label: "Welcome desk", labelBn: "স্বাগত ডেস্ক", description: "QR check-in, works offline on mobile", path: "/check-in" },

  { key: "vendors", group: "vendors", label: "Find vendors", labelBn: "ভেন্ডর খুঁজুন", description: "Search by date, budget and guest count", path: "/vendors", core: true },
  { key: "shortlist", group: "vendors", label: "Shortlist", labelBn: "পছন্দের তালিকা", description: "Compare favourites side by side", path: "/shortlist", core: true },
  { key: "bookings", group: "vendors", label: "Bookings", labelBn: "বুকিং", description: "Reservations and their status", path: "/bookings", core: true },
  { key: "quotes", group: "vendors", label: "Quotations", labelBn: "কোটেশন", description: "Quotes from vendors", path: "/packages", core: true },
  { key: "contracts", group: "vendors", label: "Agreements", labelBn: "চুক্তি", description: "Vendor agreements to review and accept", path: "/contracts" },
  { key: "finance", group: "vendors", label: "Payments", labelBn: "পেমেন্ট", description: "Invoices and payment milestones", path: "/finance" },

  { key: "runSheet", group: "dayOf", label: "Run sheet", labelBn: "রান শিট", description: "Minute-by-minute plan with live status", path: "/run-sheet" },
  { key: "vendorPortal", group: "dayOf", label: "Vendor day-of", labelBn: "ভেন্ডর সমন্বয়", description: "Vendors see their cues and check in", path: "/run-sheet?view=vendors" },
  { key: "catering", group: "dayOf", label: "Catering headcount", labelBn: "খাবারের হিসাব", description: "Plates per day and meal from RSVPs", path: "/catering" },
  { key: "photoWall", group: "dayOf", label: "Photo wall", labelBn: "ফটো ওয়াল", description: "Guests upload by QR, live slideshow", path: "/photo-wall" },
  { key: "livestream", group: "dayOf", label: "Livestream", labelBn: "লাইভ স্ট্রিম", description: "Share a live link for remote guests", path: "/website?section=livestream" },

  { key: "website", group: "share", label: "Event website", labelBn: "ইভেন্ট ওয়েবসাইট", description: "Story, schedule, map and guestbook", path: "/website" },

  { key: "collaboration", group: "team", label: "Planning circle", labelBn: "পরিকল্পনা দল", description: "Invite family or a planner", path: "/collaboration" },
  { key: "automations", group: "team", label: "Automations", labelBn: "স্বয়ংক্রিয় কাজ", description: "Reminders and rules", path: "/automations" },
  { key: "insights", group: "team", label: "Insights", labelBn: "বিশ্লেষণ", description: "Spending and attendance overview", path: "/insights" },
] as const satisfies readonly Feature[];

export type FeatureKey = (typeof featureCatalog)[number]["key"];
export const featureKeys = featureCatalog.map((f) => f.key) as FeatureKey[];
const coreKeys = featureCatalog.filter((f) => "core" in f && f.core).map((f) => f.key) as FeatureKey[];

const weddingFamily: FeatureKey[] = [
  "timeline", "datePlanner", "costSplit", "gifts", "inspiration",
  "sides", "households", "invitations", "seating", "logistics", "checkIn",
  "contracts", "finance", "runSheet", "vendorPortal", "catering", "photoWall",
  "livestream", "website", "collaboration",
];
const business: FeatureKey[] = [
  "timeline", "datePlanner", "invitations", "seating", "logistics", "checkIn",
  "contracts", "finance", "runSheet", "vendorPortal", "catering", "livestream",
  "website", "collaboration", "automations", "insights",
];

/** Default tools per occasion (in addition to the core tools). */
export const occasionDefaults: Record<EventType, FeatureKey[]> = {
  WEDDING: weddingFamily,
  HOLUD: ["datePlanner", "costSplit", "gifts", "inspiration", "sides", "households", "invitations", "catering", "photoWall", "runSheet", "collaboration"],
  RECEPTION: ["datePlanner", "costSplit", "gifts", "sides", "households", "invitations", "seating", "logistics", "checkIn", "contracts", "finance", "runSheet", "vendorPortal", "catering", "photoWall", "livestream", "collaboration"],
  ENGAGEMENT: ["datePlanner", "gifts", "inspiration", "sides", "households", "invitations", "seating", "catering", "photoWall", "website", "collaboration"],
  BIRTHDAY: ["gifts", "inspiration", "households", "invitations", "catering", "photoWall"],
  ANNIVERSARY: ["gifts", "inspiration", "households", "invitations", "catering", "photoWall", "website"],
  BABY_SHOWER: ["gifts", "inspiration", "households", "invitations", "catering", "photoWall"],
  GRADUATION: ["gifts", "invitations", "catering", "photoWall"],
  REUNION: ["datePlanner", "households", "invitations", "logistics", "checkIn", "catering", "photoWall", "website", "collaboration"],
  CORPORATE: business,
  CONFERENCE: business,
  COMMUNITY: ["datePlanner", "invitations", "checkIn", "runSheet", "catering", "livestream", "website", "collaboration"],
  GENERAL: ["invitations", "catering"],
};

export function isFeatureKey(value: string): value is FeatureKey {
  return (featureKeys as string[]).includes(value);
}

/** The tools an event shows: core + occasion defaults + enabled − disabled. */
export function featuresFor(event: { eventType: string; enabledFeatures?: string[]; disabledFeatures?: string[] }) {
  const defaults = occasionDefaults[event.eventType as EventType] || occasionDefaults.GENERAL;
  const disabled = new Set((event.disabledFeatures || []).filter((k) => !coreKeys.includes(k as FeatureKey)));
  const set = new Set<string>([...coreKeys, ...defaults, ...(event.enabledFeatures || []).filter(isFeatureKey)]);
  return featureKeys.filter((key) => set.has(key) && !disabled.has(key));
}

export function hasFeature(event: Parameters<typeof featuresFor>[0], key: FeatureKey) {
  return featuresFor(event).includes(key);
}
