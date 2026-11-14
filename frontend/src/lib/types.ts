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
  status: string;
  commissionBps: number;
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
export type Conversation = { id: string; eventId: string; vendorId: string };
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
