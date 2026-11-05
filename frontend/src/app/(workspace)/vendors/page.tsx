"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/lib/context";
import { Vendor } from "@/lib/types";
import { api } from "@/lib/api";
import { VendorCard } from "@/components/vendor-card";
import { BookingModal } from "@/components/booking-modal";
import { Empty, PageHeading } from "@/components/ui";
const categories = [
  "All vendors",
  "Venue",
  "Photography",
  "Decoration",
  "Catering",
  "Makeup",
];
export default function Vendors() {
  const { vendors, notify } = useApp();
  const [date, setDate] = useState(""),
    [available, setAvailable] = useState<Vendor[] | null>(null);
  useEffect(() => {
    if (!date) {
      setAvailable(null);
      return;
    }
    let active = true;
    void api<Vendor[]>(
      `vendors?startAt=${encodeURIComponent(`${date}T18:00:00+06:00`)}`,
    )
      .then((v) => {
        if (active) setAvailable(v);
      })
      .catch((e) => notify(e.message, true));
    return () => {
      active = false;
    };
  }, [date, notify]);
  const [category, setCategory] = useState("All vendors"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recommended"),
    [vendor, setVendor] = useState<Vendor | null>(null);
  const filtered = useMemo(
    () =>
      (available || vendors)
        .filter(
          (v) =>
            (category === "All vendors" || v.category === category) &&
            `${v.businessName} ${v.city} ${v.description}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "price"
            ? Math.min(...a.services.map((s) => s.basePriceMinor)) -
              Math.min(...b.services.map((s) => s.basePriceMinor))
            : a.businessName.localeCompare(b.businessName),
        ),
    [vendors, available, search, sort, category],
  );
  return (
    <>
      <PageHeading
        eyebrow="GOOD PEOPLE. BEAUTIFUL CELEBRATIONS."
        title="Find your dream team"
        description="Local expertise, thoughtful details, and a little wedding-day magic."
      />
      <div className="catalog-banner">
        <span>✧</span>
        <div>
          <h2>People who bring your vision to life.</h2>
          <p>Discover Bangladesh’s wedding professionals, all in one place.</p>
        </div>
      </div>
      <div className="filter-bar">
        <label className="availability-field">
          Available on
          <input
            aria-label="Check date availability"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="search-field">
          <Search size={19} />
          <input
            aria-label="Search vendors"
            placeholder="Search a vendor, city, or a little inspiration…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="sort-field">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Sort vendors"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recommended">Name: A to Z</option>
            <option value="price">Price: low to high</option>
          </select>
        </label>
      </div>
      <div className="tabs">
        {categories.map((c) => (
          <button
            key={c}
            className={c === category ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="results-count">
        {filtered.length} lovely{" "}
        {filtered.length === 1 ? "professional" : "professionals"} to discover
      </p>
      <div className="vendor-grid">
        {filtered.map((v) => (
          <VendorCard key={v.id} vendor={v} onSelect={setVendor} />
        ))}
      </div>
      {!filtered.length && (
        <Empty title="A fresh search might be the one">
          Try another name or category.
        </Empty>
      )}
      {vendor && (
        <BookingModal vendor={vendor} onClose={() => setVendor(null)} />
      )}
    </>
  );
}
