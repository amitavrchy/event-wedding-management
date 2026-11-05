import type { Booking, Guest, Payment } from "./types";
export type SeatTable = {
  id: string;
  label: string;
  capacity: number;
  shape: "ROUND" | "RECTANGLE";
  x: number;
  y: number;
  version: number;
};
export type SeatedGuest = Guest & {
  seatingTableId?: string;
  groupName: string;
  dietaryNotes?: string;
};
export type Seating = {
  tables: SeatTable[];
  guests: SeatedGuest[];
  capacity: number;
};
export type Cue = {
  id: string;
  dayId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  owner: string;
  location?: string;
  notes?: string;
  status: string;
  version: number;
};
export type Contract = {
  id: string;
  eventId: string;
  vendorId: string;
  title: string;
  body: string;
  amountMinor: number;
  contentHash: string;
  status: string;
  signerName?: string;
  signedAt?: string;
  createdAt: string;
};
export type Installment = {
  id: string;
  label: string;
  amountMinor: number;
  dueAt: string;
  status: string;
};
export type Invoice = {
  booking: Booking;
  number: string;
  payments: Payment[];
  installments: Installment[];
  paidMinor: number;
  outstandingMinor: number;
  status: string;
};
export type Lead = {
  id: string;
  name: string;
  email?: string;
  estimatedMinor: number;
  stage: string;
  eventDate?: string;
  followUpAt?: string;
  notes: string;
};
export type Activity = {
  id: string;
  actorName: string;
  action: string;
  detail: string;
  createdAt: string;
};
export type Website = {
  id: string;
  slug: string;
  headline: string;
  story: string;
  coverUrl: string;
  theme: string;
  faqs: { question: string; answer: string }[];
  published: boolean;
  version: number;
  passwordProtected: boolean;
  guestbook: { id: string; name: string; message: string; approved: boolean }[];
};
export type Automation = {
  id: string;
  title: string;
  trigger: string;
  action: string;
  message: string;
  enabled: boolean;
  daysBefore: number;
};
export type MoodItem = {
  id: string;
  kind: "IMAGE" | "COLOR" | "NOTE";
  title: string;
  value: string;
  tag: string;
};
