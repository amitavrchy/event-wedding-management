"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LanguageSwitch } from "./language-switch";
import type { User } from "@/lib/types";

const occasions = [
  [
    "WEDDING",
    "বিয়ে",
    "একসঙ্গে পথচলার শুরু",
    "আপনার মানুষ, আপনার ঐতিহ্য, আপনার সুন্দর শুরু।",
    "/images/wedding.jpg",
  ],
  [
    "BIRTHDAY",
    "জন্মদিন",
    "আপনাকে নিয়ে আরেকটি বছর",
    "প্রথম জন্মদিন থেকে বড় মাইলফলক—সবই উদযাপন করুন।",
    "/images/birthday.jpg",
  ],
  [
    "ANNIVERSARY",
    "বার্ষিকী",
    "আপনাদের গল্পের উদযাপন",
    "পুরোনো স্মৃতির সঙ্গে তৈরি হোক আরও কিছু নতুন স্মৃতি।",
    "/images/gathering.jpg",
  ],
  [
    "CORPORATE",
    "ব্যবসায়িক অনুষ্ঠান",
    "ভালো মানুষ, বড় ভাবনা",
    "দলীয় অনুষ্ঠান, উদ্বোধন এবং এগিয়ে যাওয়ার মুহূর্ত।",
    "/images/corporate.jpg",
  ],
];
const faqs = [
  [
    "উৎসব কি শুধু বিয়ের জন্য?",
    "না। জন্মদিন, বার্ষিকী, বাগদান, বেবি শাওয়ার, সমাবর্তন, পুনর্মিলনী, সম্মেলন ও আরও নানা অনুষ্ঠান পরিকল্পনা করতে পারেন। প্রতিটির জন্য সম্পাদনাযোগ্য তালিকা ও বাজেট বিভাগ আছে।",
  ],
  [
    "এখনই কি পেশাদারদের বুক করতে হবে?",
    "না। আপনার ভাবনা, অতিথি তালিকা বা বাজেট দিয়ে শুরু করুন। প্রস্তুত হলে তারিখ যোগ করুন এবং পেশাদারদের তুলনা করুন।",
  ],
  [
    "পরিকল্পনাকারী বা সহকর্মী কি সাহায্য করতে পারবেন?",
    "হ্যাঁ। আয়োজক ও ব্যবসার মালিক নির্দিষ্ট অনুমতি এবং সময়সীমা দিয়ে সহকর্মীদের আমন্ত্রণ জানাতে পারেন।",
  ],
  [
    "এখানে কি অনুষ্ঠান ব্যবসা পরিচালনা করা যায়?",
    "হ্যাঁ। গ্রাহক, রিসোর্স ক্যালেন্ডার, কোটেশন, চুক্তি, চালান, কিস্তি, দলের অনুমতি ও আয়ের তথ্য এক জায়গায় পাবেন।",
  ],
  [
    "পেমেন্ট কীভাবে কাজ করে?",
    "বর্তমানে স্যান্ডবক্সে প্রকৃত অর্থ ছাড়া অগ্রিম, বকেয়া, কিস্তি ও ফেরত পরীক্ষা করা যায়। প্রকৃত পেমেন্টের জন্য লাইভ গেটওয়ে সংযোগ প্রয়োজন।",
  ],
];
export function BanglaLanding({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("BIRTHDAY");
  const preview = occasions.find(([type]) => type === selected)!;
  const workspace = user?.role === "VENDOR" ? "/business" : "/dashboard";
  const plan = (type = "GENERAL") =>
    user
      ? user.role === "VENDOR"
        ? "/business"
        : `/dashboard?new=${type}`
      : `/signup?event=${type}`;
  return (
    <div className="landing">
      <a className="landing-skip" href="#landing-main">
        মূল বিষয়বস্তুতে যান
      </a>
      <header className="landing-header">
        <Link href="/" className="brand" aria-label="উৎসব হোম">
          utsab<span>✳</span>
        </Link>
        <nav
          className={`landing-nav ${open ? "is-open" : ""}`}
          aria-label="প্রধান নেভিগেশন"
        >
          <a href="#occasions" onClick={() => setOpen(false)}>
            সব উপলক্ষ
          </a>
          <a href="#how-it-works" onClick={() => setOpen(false)}>
            যেভাবে কাজ করে
          </a>
          <a href="#for-professionals" onClick={() => setOpen(false)}>
            পেশাদারদের জন্য
          </a>
          <Link
            className="landing-mobile-account"
            href={user ? workspace : "/login"}
          >
            {user ? "আপনার কর্মক্ষেত্র" : "সাইন ইন"}
          </Link>
        </nav>
        <div className="landing-header-actions">
          <LanguageSwitch />
          <Link className="landing-signin" href={user ? workspace : "/login"}>
            {user ? "আপনার কর্মক্ষেত্র" : "সাইন ইন"}
          </Link>
          <Link className="landing-button landing-primary" href={plan()}>
            পরিকল্পনা শুরু করুন
          </Link>
          <button
            className="landing-menu"
            aria-label={open ? "মেনু বন্ধ করুন" : "মেনু খুলুন"}
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
            <span className="landing-eyebrow">উদযাপনের প্রতিটি দিনের জন্য</span>
            <h1>
              উদযাপনের প্রতিটি কারণ <em>এক জায়গায়।</em>
            </h1>
            <p>
              জন্মদিন, নতুন শুরু কিংবা একসঙ্গে আরও একটি বছর। আপনার মানুষ,
              পরিকল্পনা ও প্রতিটি ছোট বিস্তারিত রাখুন এক জায়গায়।
            </p>
            <div className="landing-hero-actions">
              <Link
                className="landing-button landing-primary"
                href={plan(selected)}
              >
                {preview[1]} পরিকল্পনা করুন
              </Link>
              <a className="landing-text-link" href="#occasions">
                আপনার উপলক্ষ খুঁজুন →
              </a>
            </div>
            <div className="landing-hero-notes">
              <span>আপনার দিন, আপনার মতো</span>
              <span>বাংলাদেশের জন্য তৈরি</span>
            </div>
            <div
              className="landing-occasion-switch"
              aria-label="অনুষ্ঠানের নমুনা দেখুন"
            >
              {occasions.map(([type, label]) => (
                <button
                  key={type}
                  aria-pressed={selected === type}
                  onClick={() => setSelected(type)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="landing-hero-art">
            <div className="landing-hero-photo">
              <img
                src={preview[4]}
                width={720}
                height={900}
                alt={`${preview[1]} উদযাপন`}
              />
            </div>
          </div>
        </section>
        <div className="landing-ribbon">
          <span>পরিকল্পনার চাপ কম।</span>
          <strong>একসঙ্গে থাকার আনন্দ বেশি।</strong>
        </div>
        <section className="landing-occasions landing-section" id="occasions">
          <div className="landing-section-heading">
            <div>
              <span className="landing-eyebrow">
                অনেক উপলক্ষ, একটি সুন্দর জায়গা
              </span>
              <h2>
                যে কারণেই হোক <em>একসঙ্গে।</em>
              </h2>
            </div>
            <p>
              কিছু দিন একবারই আসে, কিছু দিন প্রতি বছর উদযাপনের যোগ্য। সবগুলোর
              জন্যই জায়গা রাখুন।
            </p>
          </div>
          <div className="landing-occasion-grid">
            {occasions.map(([type, label, name, description, image], i) => (
              <Link
                key={type}
                href={plan(type)}
                className={`landing-occasion-card occasion-${i}`}
              >
                <div className="landing-occasion-photo">
                  <img
                    src={image}
                    width={600}
                    height={650}
                    alt={label}
                    loading="lazy"
                  />
                  <span>{label}</span>
                </div>
                <div className="landing-occasion-copy">
                  <h3>{name}</h3>
                  <p>{description}</p>
                  <span>নিজের মতো সাজান ↗</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="landing-other-occasions">
            <span>আরও সব ছোট বড় মাইলফলক</span>
            <div>
              {[
                ["BABY_SHOWER", "বেবি শাওয়ার"],
                ["GRADUATION", "সমাবর্তন"],
                ["REUNION", "পুনর্মিলনী"],
                ["COMMUNITY", "সামাজিক সমাবেশ"],
                ["GENERAL", "অন্য কোনো উপলক্ষ?"],
              ].map(([type, label]) => (
                <Link key={type} href={plan(type)}>
                  {label} ↗
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section
          className="landing-together landing-section"
          id="the-workspace"
        >
          <div className="landing-together-copy">
            <span className="landing-eyebrow">প্রতিটি কাজ হোক সহজ</span>
            <h2>
              আপনার মতো করে <em>গোছানো।</em>
            </h2>
            <p>
              বাজেট, বুকিং, চুক্তি, অতিথি তালিকা ও পরিকল্পনার সবকিছু একসঙ্গে
              রাখুন।
            </p>
            <div className="landing-feature-list">
              <section>
                <h3>আপনার পছন্দের মানুষদের খুঁজুন।</h3>
                <p>
                  স্থানীয় পেশাদারদের খুঁজুন, তুলনা করুন এবং গুরুত্বপূর্ণ তারিখ
                  সংরক্ষণ করুন।
                </p>
              </section>
              <section>
                <h3>প্রতিটি বিস্তারিতের জন্য জায়গা।</h3>
                <p>বাজেট, বুকিং ও পেমেন্টের ধাপ একসঙ্গে রাখুন।</p>
              </section>
              <section>
                <h3>সবাইকে উদযাপনে যুক্ত করুন।</h3>
                <p>ব্যক্তিগত RSVP, বসার পরিকল্পনা, অতিথি পাস ও দলের সহায়তা।</p>
              </section>
            </div>
            <Link className="landing-text-link" href={plan()}>
              পরিকল্পনার জায়গাটি দেখুন →
            </Link>
          </div>
        </section>
        <section className="landing-how landing-section" id="how-it-works">
          <div className="landing-center-heading">
            <span className="landing-eyebrow">ভাবনা থেকে সুন্দর দিনে</span>
            <h2>
              ছোট পরিকল্পনা, <em>সুন্দর শুরু।</em>
            </h2>
          </div>
          <div className="landing-steps">
            {[
              [
                "০১",
                "আপনার মুহূর্ত দিয়ে শুরু করুন।",
                "উপলক্ষ বেছে নিয়ে একটি প্রাথমিক পরিকল্পনা তৈরি করুন।",
              ],
              [
                "০২",
                "সব বিস্তারিত এক করুন।",
                "বাজেট ও অতিথি তালিকা তৈরি করুন, পেশাদার খুঁজুন এবং সহায়তা নিন।",
              ],
              [
                "০৩",
                "উদযাপনের সময় রাখুন।",
                "সূচি, বসার ব্যবস্থা ও অতিথি অভ্যর্থনা এক জায়গায় রাখুন।",
              ],
            ].map(([n, title, description]) => (
              <article key={n}>
                <div>
                  <span>{n}</span>
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-business" id="for-professionals">
          <div className="landing-business-copy">
            <span className="landing-eyebrow">
              যাঁরা সুন্দর দিনগুলো তৈরি করেন
            </span>
            <h2>
              আপনার কাজ। তাঁদের উদযাপন। <em>একটি সংযুক্ত ব্যবসা।</em>
            </h2>
            <p>
              ভেন্যু, ক্যাটারার, সৃজনশীল পেশাদার ও অনুষ্ঠান দল: অনুসন্ধান থেকে
              অনুষ্ঠান পরিচালনা পর্যন্ত ব্যবসার সব বিস্তারিত সামলান।
            </p>
            <div className="landing-business-features">
              <span>গ্রাহক ও ফলোআপ</span>
              <span>রিসোর্স ক্যালেন্ডার ও প্রাপ্যতা</span>
              <span>কোটেশন, চুক্তি ও চালান</span>
              <span>দলের অনুমতি ও আয়ের তথ্য</span>
            </div>
            <Link
              className="landing-button landing-light"
              href={
                user?.role === "VENDOR" ? "/business" : "/signup?role=VENDOR"
              }
            >
              আপনার অনুষ্ঠান ব্যবসা গড়ুন
            </Link>
          </div>
        </section>
        <section className="landing-faq landing-section" id="questions">
          <div>
            <span className="landing-eyebrow">আপনার কিছু প্রশ্ন</span>
            <h2>
              আরও একটু <em>জেনে নিন।</em>
            </h2>
          </div>
          <div className="landing-faq-items">
            {faqs.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <div>
            <h2>
              আপনার মতো করে <em>উদযাপন হোক।</em>
            </h2>
            <p>যে উপলক্ষই হোক, আপনাকে স্বাগতম।</p>
            <Link className="landing-button landing-primary" href={plan()}>
              পরবর্তী উদযাপনের পরিকল্পনা করুন
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <Link className="brand" href="/">
            utsab<span>✳</span>
          </Link>
          <p>বড় মুহূর্ত, ছোট বিস্তারিত। সুন্দরভাবে একসঙ্গে।</p>
          <span>বাংলাদেশের জন্য যত্নে তৈরি।</span>
        </div>
        <nav aria-label="উৎসব ঘুরে দেখুন">
          <strong>ঘুরে দেখুন</strong>
          <a href="#occasions">সব উপলক্ষ</a>
          <a href="#the-workspace">পরিকল্পনার জায়গা</a>
          <a href="#how-it-works">যেভাবে কাজ করে</a>
        </nav>
        <nav aria-label="পরবর্তী পদক্ষেপ">
          <strong>পরবর্তী পদক্ষেপ</strong>
          <Link href={plan()}>অনুষ্ঠান পরিকল্পনা</Link>
          <Link href="/signup?role=VENDOR">পেশাদারদের জন্য</Link>
          <Link href={user ? workspace : "/login"}>আপনার কর্মক্ষেত্র</Link>
        </nav>
        <nav aria-label="নীতিমালা">
          <strong>নীতিমালা</strong>
          <Link href="/terms">শর্তাবলি</Link>
          <Link href="/privacy">গোপনীয়তা</Link>
          <Link href="/refund-policy">ফেরত</Link>
        </nav>
        <div className="landing-footer-bottom">
          <span>© {new Date().getFullYear()} Utsab</span>
          <a href="#landing-main">উপরে যান ↑</a>
        </div>
      </footer>
    </div>
  );
}
