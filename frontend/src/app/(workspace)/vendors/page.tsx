"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import "@/app/tools.css";
import { useApp } from "@/lib/context";
import type { Paged, Vendor } from "@/lib/types";
import { useResource } from "@/lib/use-resource";
import { VendorCard } from "@/components/vendor-card";
import { VendorSheet } from "@/components/vendor-sheet";
import { Button, Empty, Field, PageHeading } from "@/components/ui";

/** Marketplace search: date, guests, budget and area filters run on the server. */
export default function Vendors() {
  const { event } = useApp();
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
      <PageHeading
        eyebrow="GOOD PEOPLE. BEAUTIFUL CELEBRATIONS."
        title="Find your dream team"
        description="Search by your date, guest count and budget to see who fits."
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
              Match my event
            </Button>
          )
        }
      />
      <div className="vendor-filters">
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Search vendors"
            placeholder="Name or service…"
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
          />
        </div>
        <Field label="Category">
          <select
            value={filters.category}
            onChange={(e) => set("category", e.target.value)}
          >
            <option value="">All</option>
            {categories.data.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Area or city">
          <input
            value={filters.area}
            placeholder="Dhanmondi"
            onChange={(e) => set("area", e.target.value)}
          />
        </Field>
        <Field label="Free on">
          <input
            type="date"
            value={filters.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </Field>
        <Field label="Guests">
          <input
            type="number"
            min="1"
            value={filters.guests}
            onChange={(e) => set("guests", e.target.value)}
          />
        </Field>
        <Field label="Budget up to (৳)">
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
          <span>Verified only</span>
        </label>
      </div>
      <p className="results-count">
        {results.data
          ? `${results.data.total} ${results.data.total === 1 ? "professional" : "professionals"} match`
          : "Searching…"}
      </p>
      <div className="vendor-grid">
        {results.data?.items.map((v) => (
          <VendorCard key={v.id} vendor={v} onSelect={setVendor} />
        ))}
      </div>
      {results.data && !results.data.items.length && (
        <Empty title="No one matches yet">
          Try a different date, area or budget.
        </Empty>
      )}
      {results.data && results.data.pages > 1 && (
        <nav className="pager" aria-label="Pages">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page} of {results.data.pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= results.data.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
      <p className="helper-text">
        Sponsored listings are paid placements and are always labelled.
      </p>
      {vendor && (
        <VendorSheet vendor={vendor} onClose={() => setVendor(null)} />
      )}
    </>
  );
}
