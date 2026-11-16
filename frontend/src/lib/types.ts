export type User = {
  id: string;
  fullName: string;
  role: "HOST" | "VENDOR" | "PLATFORM_ADMIN";
  email?: string;
  phone?: string | null;
  locale?: "en" | "bn";
  emailVerified?: boolean;
  phoneVerified?: boolean;
  twoFactorEnabled?: boolean;
};
export type FeatureGroup = { key: string; label: string; labelBn: string };
export type Feature = {
  key: string;
  group: string;
  label: string;
  labelBn: string;
  description: string;
  path: string;
  core?: boolean;
};
export type FeatureCatalog = {
  groups: FeatureGroup[];
  features: Feature[];
  occasionDefaults: Record<string, string[]>;
};
export type Vendor = {
  id: string;
  slug: string;
  businessName: string;
  category: string;
  city: string;
  description: string;
  image: string;
  status?: string;
  commissionBps?: number;
  logo?: string | null;
  gallery?: string[];
  serviceAreas?: string[];
  priceFromMinor?: number | null;
  verified?: boolean;
  verifiedAt?: string | null;
  sponsored?: boolean;
  ratingAvg?: number;
  ratingCount?: number;
  responseMinutes?: number | null;
  phone?: string | null;
  planCode?: string | null;
  attributes?: Record<string, string | number | boolean> | null;
  services: Service[];
};
export type Service = {
  id: string;
  vendorId: string;
  title: string;
  basePriceMinor: number;
  durationHours: number;
  bufferHours: number;
  capacity?: number;
  description?: string | null;
  active?: boolean;
  vendor?: Vendor;
};
export type Day = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  venueName?: string;
};
export type Task = { id: string; title: string; done: boolean; dueAt?: string };
export type Guest = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  partySize: number;
  maxPartySize: number;
  rsvpStatus: string;
  token: string;
  mealPreference?: string;
  tableLabel?: string;
  seatingTableId?: string;
  groupName?: string;
  dietaryNotes?: string;
  side?: "BRIDE" | "GROOM" | "BOTH" | null;
  householdId?: string | null;
  relationship?: string | null;
  invitationSentAt?: string | null;
  invitationOpenedAt?: string | null;
};
export type Household = {
  id: string;
  name: string;
  side?: "BRIDE" | "GROOM" | "BOTH" | null;
  phone?: string | null;
  token?: string;
  invitationSentAt?: string | null;
  invitationOpenedAt?: string | null;
  members: {
    id: string;
    name: string;
    rsvpStatus: string;
    partySize: number;
    maxPartySize: number;
  }[];
};
export type SideSummary = {
  side: "BRIDE" | "GROOM" | "BOTH" | null;
  label: string;
  quota: number | null;
  invitations: number;
  invitedPeople: number;
  acceptedPeople: number;
};
export type Paged<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};
export type Booking = {
  id: string;
  eventId: string;
  vendorId: string;
  serviceId: string;
  status: string;
  startAt: string;
  endAt: string;
  holdExpiresAt: string;
  priceMinor: number;
  advanceMinor: number;
  category: string;
  service: Service;
  event?: Event;
};
export type BudgetItem = { id: string; category: string; plannedMinor: number };
export type Expense = {
  id: string;
  category: string;
  amountMinor: number;
  note: string;
  paidBy?: "BRIDE" | "GROOM" | "SHARED" | null;
  receiptMediaId?: string | null;
};
export type Event = {
  id: string;
  hostId?: string;
  access?: "OWNER" | "EDITOR" | "VIEWER";
  title: string;
  eventType: string;
  city: string;
  budgetMinor: number;
  guestCapacity: number;
  rsvpDeadline?: string;
  sides?: Record<
    string,
    { label?: string; quota?: number | null; share?: number }
  > | null;
  livestreamUrl?: string | null;
  features?: string[];
  enabledFeatures?: string[];
  disabledFeatures?: string[];
  archivedAt?: string | null;
  days: Day[];
  tasks: Task[];
  guests: Guest[];
  bookings: Booking[];
  budget: BudgetItem[];
  expenses: Expense[];
};
export type Payment = {
  id: string;
  bookingId: string;
  amountMinor: number;
  kind: string;
  provider: string;
  status: string;
  createdAt: string;
};
export type Bundle = {
  id: string;
  title: string;
  description: string;
  priceMinor: number;
  discountBps: number;
  services: Service[];
};
export type Conversation = {
  id: string;
  eventId: string;
  vendorId: string;
  vendorName?: string;
  eventTitle?: string;
};
export type Message = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
};
export type Quote = {
  id: string;
  vendorId: string;
  amountMinor: number;
  status: string;
  expiresAt: string;
  breakdown: { label: string; amountMinor: number }[];
};
