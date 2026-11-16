"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import "@/app/tools.css";
import { usePublicLocale } from "@/lib/public-i18n";
import { LanguageSwitch } from "@/components/language-switch";
import { useApp } from "@/lib/context";
import type { Paged, Vendor } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { VendorCard } from "@/components/vendor-card";
import { VendorSheet } from "@/components/vendor-sheet";
import { Button, Empty, Field, PageHeading } from "@/components/ui";

/** Marketplace search: date, guests, budget and area filters run on the server. */
export default function Vendors() {
  const { event } = useApp();
  const { locale } = usePublicLocale();
  const bn = locale === "bn";
  const categories = useResource<{ name: string }[]>("categories", []);
  const [filters, setFilters] = useState({
    q: "",
    category: "",
    area: "",
    date: "",
    guests: "",
    budget: "",
    verified: false,
  });
  const [debounced, setDebounced] = useState(filters);
  const [page, setPage] = useState(1);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);
  const query = new URLSearchParams({ page: String(page), limit: "24" });
  if (debounced.q) query.set("q", debounced.q);
  if (debounced.category) query.set("category", debounced.category);
  if (debounced.area) query.set("area", debounced.area);
  if (debounced.date) query.set("startAt", `${debounced.date}T18:00:00+06:00`);
  if (debounced.guests) query.set("guests", debounced.guests);
  if (debounced.budget)
    query.set(
      "budgetMinor",
      String(Math.round(Number(debounced.budget) * 100)),
    );
  if (debounced.verified) query.set("verified", "true");
  const results = useResource<Paged<Vendor> | null>(`vendors?${query}`, null);
  const set = (key: keyof typeof filters, value: string | boolean) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const firstDay = event?.days
    ?.slice()
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return (
    <>
      <LanguageSwitch />
      <PageHeading
        eyebrow={
          bn
            ? "ভালো মানুষ। সুন্দর উদযাপন।"
            : "GOOD PEOPLE. BEAUTIFUL CELEBRATIONS."
        }
        title={bn ? "আপনার পছন্দের দল খুঁজুন" : "Find your dream team"}
        description={
          bn
            ? "তারিখ, অতিথি সংখ্যা ও বাজেট দিয়ে উপযুক্ত পেশাদার খুঁজুন।"
            : "Search by your date, guest count and budget to see who fits."
        }
        action={
          event && (
            <Button
              variant="secondary"
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  date: firstDay?.startsAt.slice(0, 10) || f.date,
                  guests: String(event.guestCapacity),
                  area: event.city,
                }))
              }
            >
              {bn ? "আমার অনুষ্ঠানের সঙ্গে মেলান" : "Match my event"}
            </Button>
          )
        }
      />
      <div className="vendor-filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label={bn ? "বিক্রেতা খুঁজুন" : "Search vendors"}
            placeholder={bn ? "নাম বা সেবা…" : "Name or service…"}
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <Field label={bn ? "বিভাগ" : "Category"}>
          <select
            value={filters.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">{bn ? "সব" : "All"}</option>
            {categories.data.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "এলাকা বা শহর" : "Area or city"}>
          <input
            value={filters.area}
            placeholder={bn ? "ধানমন্ডি" : "Dhanmondi"}
            onChange={(e) => set("area", e.target.value)}
          />
        </Field>
        <Field label={bn ? "যে তারিখে খালি" : "Free on"}>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label={bn ? "অতিথি" : "Guests"}>
          <input
            type="number"
            min="1"
            value={filters.guests}
            onChange={(e) => set("guests", e.target.value)}
          />
        </Field>
        <Field label={bn ? "সর্বোচ্চ বাজেট (৳)" : "Budget up to (৳)"}>
          <input
            type="number"
            min="0"
            value={filters.budget}
            onChange={(e) => set("budget", e.target.value)}
          />
        </Field>
        <label className="check-field">
          <input
            type="checkbox"
            checked={filters.verified}
            onChange={(e) => set("verified", e.target.checked)}
          />
          <span>{bn ? "শুধু যাচাইকৃত" : "Verified only"}</span>
        </label>
      </div>
      <p className="results-count">
        {results.data
          ? bn
            ? `${results.data.total} জন পেশাদার পাওয়া গেছে`
            : `${results.data.total} ${results.data.total === 1 ? "professional" : "professionals"} match`
          : bn
            ? "খোঁজা হচ্ছে…"
            : "Searching…"}
      </p>
      <div className="vendor-grid">
        {results.data?.items.map((v) => (
          <VendorCard key={v.id} vendor={v} onSelect={setVendor} />
        ))}
      </div>
      {results.data && !results.data.items.length && (
        <Empty title={bn ? "এখনও কাউকে পাওয়া যায়নি" : "No one matches yet"}>
          {bn
            ? "অন্য তারিখ, এলাকা বা বাজেট দিয়ে চেষ্টা করুন।"
            : "Try a different date, area or budget."}
        </Empty>
      )}
      {results.data && results.data.pages > 1 && (
        <nav className="pager" aria-label={bn ? "পৃষ্ঠা" : "Pages"}>
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {bn ? "আগের পৃষ্ঠা" : "Previous"}
          </Button>
          <span>
            {bn
              ? `পৃষ্ঠা ${page} / ${results.data.pages}`
              : `Page ${page} of ${results.data.pages}`}
          </span>
          <Button
            variant="secondary"
            disabled={page >= results.data.pages}
            onClick={() => setPage(page + 1)}
          >
            {bn ? "পরের পৃষ্ঠা" : "Next"}
          </Button>
        </nav>
      )}
      <p className="helper-text">
        {bn
          ? "স্পন্সর করা তালিকা অর্থের বিনিময়ে দেখানো হয় এবং সবসময় চিহ্নিত থাকে।"
          : "Sponsored listings are paid placements and are always labelled."}
      </p>
      {vendor && (
        <VendorSheet vendor={vendor} onClose={() => setVendor(null)} />
      )}
    </>
  );
}
