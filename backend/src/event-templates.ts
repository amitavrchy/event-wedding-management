import { money } from "./domain";
export const eventTypes = [
  "GENERAL",
  "WEDDING",
  "BIRTHDAY",
  "ANNIVERSARY",
  "CORPORATE",
  "CONFERENCE",
  "ENGAGEMENT",
  "HOLUD",
  "RECEPTION",
  "BABY_SHOWER",
  "GRADUATION",
  "REUNION",
  "COMMUNITY",
] as const;
export type EventType = (typeof eventTypes)[number];
type Template = {
  type: EventType;
  label: string;
  labelBn: string;
  description: string;
  budgetMinor: number;
  guestCapacity: number;
  durationHours: number;
  dayName: string;
  checklist: string[];
  allocations: { category: string; bps: number }[];
};
const social = [
  { category: "Venue", bps: 2500 },
  { category: "Catering", bps: 3000 },
  { category: "Decoration", bps: 2000 },
  { category: "Photography", bps: 1500 },
  { category: "Other", bps: 1000 },
];
const business = [
  { category: "Venue", bps: 3000 },
  { category: "Catering", bps: 2500 },
  { category: "AV & production", bps: 2000 },
  { category: "Event planning", bps: 1500 },
  { category: "Other", bps: 1000 },
];
export const eventTemplates: Template[] = [
  {
    type: "GENERAL",
    label: "General celebration",
    labelBn: "অন্যান্য অনুষ্ঠান",
    description:
      "A flexible starting point for any gathering worth bringing together.",
    budgetMinor: 20000000,
    guestCapacity: 80,
    durationHours: 4,
    dayName: "The celebration",
    checklist: [
      "Define your occasion and priorities",
      "Choose a date and shortlist venues",
      "Build your guest list",
      "Find your event professionals",
      "Confirm food, timings, and final details",
    ],
    allocations: social,
  },
  {
    type: "WEDDING",
    label: "Wedding",
    labelBn: "বিয়ে",
    description:
      "Bring your people, traditions, and every beautiful wedding detail together.",
    budgetMinor: 150000000,
    guestCapacity: 300,
    durationHours: 6,
    dayName: "Wedding ceremony",
    checklist: [
      "Set your wedding priorities and guest count",
      "Book your venue and celebration dates",
      "Shortlist photography and decoration teams",
      "Choose your catering menu",
      "Send personal invitations",
      "Confirm ceremony timings and professional handoffs",
    ],
    allocations: [
      { category: "Venue", bps: 3000 },
      { category: "Catering", bps: 3000 },
      { category: "Decoration", bps: 2000 },
      { category: "Photography", bps: 1000 },
      { category: "Attire", bps: 500 },
      { category: "Other", bps: 500 },
    ],
  },
  {
    type: "BIRTHDAY",
    label: "Birthday",
    labelBn: "জন্মদিন",
    description:
      "From first candles to big milestones: a personal, joyful birthday plan.",
    budgetMinor: 10000000,
    guestCapacity: 50,
    durationHours: 4,
    dayName: "Birthday celebration",
    checklist: [
      "Choose a birthday theme and guest count",
      "Reserve your space and celebration date",
      "Choose the cake and dessert table",
      "Arrange decoration, games, or entertainment",
      "Send invitations and collect dietary preferences",
      "Plan the cake-cutting moment and running order",
    ],
    allocations: [
      { category: "Venue", bps: 2000 },
      { category: "Catering", bps: 3000 },
      { category: "Decoration", bps: 2000 },
      { category: "Cake & desserts", bps: 2000 },
      { category: "Entertainment", bps: 1000 },
    ],
  },
  {
    type: "ANNIVERSARY",
    label: "Anniversary",
    labelBn: "বিবাহবার্ষিকী",
    description:
      "An intimate dinner or a room full of memories—celebrate your next chapter.",
    budgetMinor: 15000000,
    guestCapacity: 60,
    durationHours: 3,
    dayName: "Anniversary celebration",
    checklist: [
      "Choose an intimate or larger celebration",
      "Book a meaningful venue or dinner setting",
      "Curate the menu and anniversary cake",
      "Gather photographs, memories, and a playlist",
      "Invite your favorite people",
      "Plan a toast and a few personal surprises",
    ],
    allocations: [
      { category: "Venue", bps: 2500 },
      { category: "Catering", bps: 3500 },
      { category: "Decoration", bps: 1500 },
      { category: "Photography", bps: 1500 },
      { category: "Cake & desserts", bps: 1000 },
    ],
  },
  {
    type: "CORPORATE",
    label: "Corporate event",
    labelBn: "কর্পোরেট ইভেন্ট",
    description:
      "Team days, launches, offsites, and company celebrations with a clear plan.",
    budgetMinor: 75000000,
    guestCapacity: 150,
    durationHours: 6,
    dayName: "Company event",
    checklist: [
      "Define the objective, format, and stakeholders",
      "Confirm venue, guest capacity, and AV needs",
      "Build the agenda and speaker or team brief",
      "Arrange catering and dietary requirements",
      "Send invitations and prepare check-in",
      "Confirm suppliers, responsibilities, and the run sheet",
    ],
    allocations: business,
  },
  {
    type: "CONFERENCE",
    label: "Conference & seminar",
    labelBn: "সম্মেলন ও সেমিনার",
    description:
      "Coordinate speakers, sessions, delegates, and venue operations.",
    budgetMinor: 150000000,
    guestCapacity: 250,
    durationHours: 8,
    dayName: "Conference day",
    checklist: [
      "Set the theme and session structure",
      "Confirm the venue, capacity, and technical requirements",
      "Invite speakers and collect session details",
      "Open delegate invitations and check-in preparation",
      "Coordinate catering and accessibility needs",
      "Publish the run sheet and brief the event team",
    ],
    allocations: business,
  },
  {
    type: "ENGAGEMENT",
    label: "Engagement",
    labelBn: "বাগদান / আংটি বদল",
    description: "A beautiful beginning for your people and your next chapter.",
    budgetMinor: 40000000,
    guestCapacity: 120,
    durationHours: 4,
    dayName: "Engagement celebration",
    checklist: [
      "Choose the format and guest list",
      "Reserve a venue and confirm the date",
      "Arrange rings, florals, and photography",
      "Choose the celebration menu",
      "Send invitations",
      "Plan the ring exchange and family moments",
    ],
    allocations: social,
  },
  {
    type: "HOLUD",
    label: "Gaye Holud",
    labelBn: "গায়ে হলুদ",
    description:
      "Color, music, and the traditions that bring everyone together.",
    budgetMinor: 50000000,
    guestCapacity: 150,
    durationHours: 5,
    dayName: "Gaye Holud",
    checklist: [
      "Choose your holud palette and traditions",
      "Book the venue and decoration team",
      "Arrange music and performances",
      "Finalize food and guest invitations",
      "Plan family entrances and the holud ceremony",
    ],
    allocations: social,
  },
  {
    type: "RECEPTION",
    label: "Reception",
    labelBn: "বৌভাত / রিসেপশন",
    description:
      "A warm welcome, a thoughtful dinner, and a celebration to remember.",
    budgetMinor: 80000000,
    guestCapacity: 200,
    durationHours: 5,
    dayName: "Reception",
    checklist: [
      "Confirm the venue and reception guest count",
      "Book catering and decoration",
      "Coordinate photography and stage setup",
      "Share invitations and collect responses",
      "Prepare seating, welcomes, and dinner timings",
    ],
    allocations: social,
  },
  {
    type: "BABY_SHOWER",
    label: "Baby shower",
    labelBn: "সাধ / বেবি শাওয়ার",
    description: "A sweet, thoughtful gathering for a new little beginning.",
    budgetMinor: 8000000,
    guestCapacity: 40,
    durationHours: 3,
    dayName: "Baby shower",
    checklist: [
      "Choose a comfortable setting and theme",
      "Build a close-circle guest list",
      "Arrange food, cake, and dietary preferences",
      "Plan gentle games, gifts, and a memory corner",
      "Send invitations and confirm the running order",
    ],
    allocations: social,
  },
  {
    type: "GRADUATION",
    label: "Graduation",
    labelBn: "গ্র্যাজুয়েশন",
    description: "Mark a well-earned milestone with your proudest people.",
    budgetMinor: 12000000,
    guestCapacity: 70,
    durationHours: 4,
    dayName: "Graduation celebration",
    checklist: [
      "Choose a celebration format and guest count",
      "Reserve the venue and photography",
      "Arrange food and a celebration cake",
      "Collect speeches, memories, and music",
      "Send invitations and plan the big toast",
    ],
    allocations: social,
  },
  {
    type: "REUNION",
    label: "Family & friends reunion",
    labelBn: "পুনর্মিলনী",
    description:
      "Good stories, familiar faces, and a little room to reconnect.",
    budgetMinor: 18000000,
    guestCapacity: 100,
    durationHours: 5,
    dayName: "Reunion gathering",
    checklist: [
      "Choose a date that works for your group",
      "Confirm the venue and shared budget",
      "Reconnect the guest list and send invitations",
      "Arrange food, games, and shared memories",
      "Plan arrivals, seating, and a group photograph",
    ],
    allocations: social,
  },
  {
    type: "COMMUNITY",
    label: "Community gathering",
    labelBn: "কমিউনিটি অনুষ্ঠান",
    description: "Bring your neighborhood, club, or cause together with care.",
    budgetMinor: 30000000,
    guestCapacity: 200,
    durationHours: 5,
    dayName: "Community gathering",
    checklist: [
      "Define the purpose, organizers, and guest capacity",
      "Confirm venue access and event permissions",
      "Arrange food, equipment, and volunteer roles",
      "Share invitations and prepare guest check-in",
      "Brief the team on the schedule and accessibility",
    ],
    allocations: business,
  },
];
export function templateFor(type: EventType) {
  return eventTemplates.find((t) => t.type === type)!;
}
export function allocateBudget(
  total: number,
  allocations: Template["allocations"],
) {
  money(total);
  if (
    allocations.reduce((s, a) => s + a.bps, 0) !== 10000 ||
    allocations.some((a) => a.bps < 0) ||
    new Set(allocations.map((a) => a.category)).size !== allocations.length
  )
    throw new Error("Invalid event budget allocation");
  let allocated = 0;
  return allocations.map((allocation, index) => {
    const plannedMinor =
      index === allocations.length - 1
        ? total - allocated
        : Math.floor((total * allocation.bps) / 10000);
    allocated += plannedMinor;
    return { category: allocation.category, plannedMinor };
  });
}
