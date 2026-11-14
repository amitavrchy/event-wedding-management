import { appUrl } from "../config";

export type Locale = "en" | "bn";
type Vars = Record<string, string | number>;
type Template = { subject: string; body: string };

/**
 * Transactional message copy in English and Bangla. Keep each body short
 * enough for a single SMS segment where it may be sent by SMS.
 */
const templates: Record<string, Record<Locale, Template>> = {
  verifyEmail: {
    en: {
      subject: "Confirm your Ayojon email",
      body: "Your Ayojon verification code is {code}. It expires in 15 minutes. Or open: {link}",
    },
    bn: {
      subject: "আয়োজন ইমেইল নিশ্চিত করুন",
      body: "আপনার আয়োজন যাচাই কোড {code}। ১৫ মিনিটের মধ্যে ব্যবহার করুন। অথবা খুলুন: {link}",
    },
  },
  resetPassword: {
    en: {
      subject: "Reset your Ayojon password",
      body: "Someone asked to reset your Ayojon password. Open this link within 30 minutes: {link}\nIf this was not you, ignore this message.",
    },
    bn: {
      subject: "আয়োজন পাসওয়ার্ড রিসেট",
      body: "আপনার আয়োজন পাসওয়ার্ড রিসেটের অনুরোধ এসেছে। ৩০ মিনিটের মধ্যে এই লিংক খুলুন: {link}\nআপনি না করে থাকলে উপেক্ষা করুন।",
    },
  },
  phoneOtp: {
    en: { subject: "Ayojon code", body: "Your Ayojon code is {code}. Valid for 10 minutes. Do not share it." },
    bn: { subject: "আয়োজন কোড", body: "আপনার আয়োজন কোড {code}। ১০ মিনিট বৈধ। কাউকে জানাবেন না।" },
  },
  passwordChanged: {
    en: {
      subject: "Your Ayojon password was changed",
      body: "Your password was changed and other devices were signed out. If this was not you, reset your password now: {link}",
    },
    bn: {
      subject: "আয়োজন পাসওয়ার্ড পরিবর্তন হয়েছে",
      body: "আপনার পাসওয়ার্ড পরিবর্তন হয়েছে এবং অন্য ডিভাইস থেকে সাইন আউট করা হয়েছে। আপনি না করে থাকলে এখনই রিসেট করুন: {link}",
    },
  },
  newInquiry: {
    en: { subject: "New inquiry on Ayojon", body: "{name} sent you an inquiry for {date}. Reply soon: {link}" },
    bn: { subject: "আয়োজনে নতুন জিজ্ঞাসা", body: "{name} {date} তারিখের জন্য জিজ্ঞাসা পাঠিয়েছেন। দ্রুত উত্তর দিন: {link}" },
  },
  newQuote: {
    en: { subject: "You received a quotation", body: "{vendor} sent a quotation of BDT {amount}. Review it: {link}" },
    bn: { subject: "নতুন কোটেশন", body: "{vendor} ৳{amount} এর কোটেশন পাঠিয়েছে। দেখুন: {link}" },
  },
  bookingUpdate: {
    en: { subject: "Booking update", body: "{title}: {status}. Details: {link}" },
    bn: { subject: "বুকিং আপডেট", body: "{title}: {status}। বিস্তারিত: {link}" },
  },
  workspaceInvite: {
    en: { subject: "You're invited to plan together", body: "{inviter} invited you to help plan {event}. Accept: {link}" },
    bn: { subject: "একসাথে পরিকল্পনার আমন্ত্রণ", body: "{inviter} আপনাকে {event} পরিকল্পনায় আমন্ত্রণ জানিয়েছেন। গ্রহণ করুন: {link}" },
  },
  newMessage: {
    en: { subject: "New message", body: "{name}: {preview}" },
    bn: { subject: "নতুন বার্তা", body: "{name}: {preview}" },
  },
};

export function render(name: keyof typeof templates, locale: string, vars: Vars = {}): Template {
  const set = templates[name];
  const chosen = set[(locale === "bn" ? "bn" : "en") as Locale];
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
  return { subject: fill(chosen.subject), body: fill(chosen.body) };
}

export const link = (path: string) => `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
