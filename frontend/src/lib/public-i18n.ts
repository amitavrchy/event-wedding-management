"use client";
import { useEffect, useSyncExternalStore } from "react";

/** Copy for guest-facing pages (RSVP, family RSVP, photo wall, website). */
const copy = {
  en: {
    invitedTitle: "You are warmly invited",
    together: "TOGETHER WITH OUR FAMILIES",
    intro: "Some moments are too beautiful to celebrate without you.",
    dear: "Dear",
    wouldLove: "We would love to have you by our side.",
    venueTba: "Venue to be announced",
    willYou: "Will you celebrate with us?",
    accept: "Joyfully accept",
    decline: "Regretfully decline",
    maybe: "Let me get back to you",
    partySize: "Your party size",
    meal: "Meal preference",
    regular: "Regular",
    vegetarian: "Vegetarian",
    noBeef: "No beef",
    dietary: "Allergies or dietary notes",
    dietaryHint: "Anything our catering team should know?",
    perDay: "A reply for each celebration",
    there: "I’ll be there",
    unable: "Unable to attend",
    deciding: "Still deciding",
    send: "Send with love",
    replyBy: "Kindly reply by",
    thanks: "Your reply means the world.",
    thanksSub: "Thank you for being part of our story.",
    update: "Update your reply",
    opening: "Opening your invitation…",
    watchLive: "Watch live",
    familyTitle: "An invitation for your family",
    familyIntro: "Reply for each member of your family below.",
    sendAll: "Send our replies",
    photosTitle: "Share your photos",
    photosIntro:
      "Your photos appear on the celebration screen after the hosts approve them.",
    yourName: "Your name (optional)",
    choosePhotos: "Choose photos",
    uploading: "Uploading…",
    uploaded: "Thank you! Your photos were shared.",
    language: "বাংলা",
  },
  bn: {
    invitedTitle: "আপনাকে সাদর আমন্ত্রণ",
    together: "পরিবারের সবার পক্ষ থেকে",
    intro: "কিছু মুহূর্ত আপনাকে ছাড়া অসম্পূর্ণ।",
    dear: "প্রিয়",
    wouldLove: "আপনার উপস্থিতি আমাদের আনন্দকে পূর্ণ করবে।",
    venueTba: "ভেন্যু শীঘ্রই জানানো হবে",
    willYou: "আপনি কি আসবেন?",
    accept: "অবশ্যই আসব",
    decline: "দুঃখিত, আসতে পারব না",
    maybe: "পরে জানাব",
    partySize: "মোট কতজন আসবেন",
    meal: "খাবারের পছন্দ",
    regular: "সাধারণ",
    vegetarian: "নিরামিষ",
    noBeef: "গরুর মাংস ছাড়া",
    dietary: "অ্যালার্জি বা খাবার সংক্রান্ত তথ্য",
    dietaryHint: "রান্নার দলকে কিছু জানাতে চান?",
    perDay: "প্রতিটি অনুষ্ঠানের জন্য উত্তর",
    there: "আসব",
    unable: "আসতে পারব না",
    deciding: "এখনো ঠিক করিনি",
    send: "উত্তর পাঠান",
    replyBy: "অনুগ্রহ করে উত্তর দিন",
    thanks: "আপনার উত্তরের জন্য ধন্যবাদ।",
    thanksSub: "আমাদের আনন্দের অংশ হওয়ার জন্য কৃতজ্ঞ।",
    update: "উত্তর পরিবর্তন করুন",
    opening: "দাওয়াত খোলা হচ্ছে…",
    watchLive: "সরাসরি দেখুন",
    familyTitle: "আপনার পরিবারের জন্য দাওয়াত",
    familyIntro: "নিচে পরিবারের প্রত্যেকের জন্য উত্তর দিন।",
    sendAll: "উত্তর পাঠান",
    photosTitle: "আপনার ছবি শেয়ার করুন",
    photosIntro: "আয়োজকরা অনুমোদন দিলে ছবিগুলো অনুষ্ঠানের পর্দায় দেখা যাবে।",
    yourName: "আপনার নাম (ঐচ্ছিক)",
    choosePhotos: "ছবি বাছাই করুন",
    uploading: "আপলোড হচ্ছে…",
    uploaded: "ধন্যবাদ! আপনার ছবি শেয়ার হয়েছে।",
    language: "English",
  },
} as const;

export type PublicLocale = keyof typeof copy;
export type PublicCopy = (typeof copy)["en"];

const key = "ayojon-guest-locale";
let current: PublicLocale = "en";
let initialized = false;
const listeners = new Set<() => void>();
function publish(locale: PublicLocale) {
  current = locale;
  document.documentElement.lang = locale;
  listeners.forEach((listener) => listener());
}
function savedLocale() {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === key &&
      (event.newValue === "en" || event.newValue === "bn")
    )
      publish(event.newValue);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
export function usePublicLocale(preferred?: PublicLocale | "both" | null) {
  const locale = useSyncExternalStore(
    subscribe,
    () => current,
    () => "en" as PublicLocale,
  );
  useEffect(() => {
    const saved = savedLocale();
    if (saved === "en" || saved === "bn") publish(saved);
    else if (preferred) publish(preferred === "en" ? "en" : "bn");
    else if (!initialized)
      publish(navigator.language?.startsWith("bn") ? "bn" : "en");
    initialized = true;
  }, [preferred]);
  const toggle = () => {
    const next = current === "bn" ? "en" : "bn";
    try {
      localStorage.setItem(key, next);
    } catch {}
    publish(next);
  };
  return { locale, t: copy[locale] as PublicCopy, toggle };
}

export const dateIn = (locale: PublicLocale, value: string) =>
  new Date(value).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
