"use client";
import Link from "next/link";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { taka } from "@/lib/format";
import { usePublicLocale } from "@/lib/public-i18n";
import type { Vendor } from "@/lib/types";
import { LanguageSwitch } from "./language-switch";
type Review = {
  id: string;
  rating: number;
  body: string;
  reply?: string;
  createdAt: string;
};
export function PublicVendorProfile({
  vendor,
  reviews,
  jsonLd,
}: {
  vendor: Vendor;
  reviews: Review[];
  jsonLd: object;
}) {
  const { locale } = usePublicLocale();
  const bn = locale === "bn";
  return (
    <main className="legal-page vendor-profile">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <Link className="brand" href="/">
        utsab<span>✳</span>
      </Link>
      <LanguageSwitch />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={vendor.image}
        alt=""
        style={{
          width: "100%",
          maxHeight: 360,
          objectFit: "cover",
          borderRadius: 18,
          marginTop: 16,
        }}
      />
      <h1>
        {vendor.businessName}{" "}
        {vendor.verified && (
          <BadgeCheck size={22} aria-label={bn ? "যাচাইকৃত" : "Verified"} />
        )}
      </h1>
      <p className="muted">
        <MapPin size={15} /> {vendor.category} · {vendor.city}
        {vendor.serviceAreas?.length
          ? ` · ${bn ? "সেবার এলাকা" : "serves"} ${vendor.serviceAreas.join(", ")}`
          : ""}
        {vendor.ratingCount ? (
          <>
            {" "}
            · <Star size={14} /> {vendor.ratingAvg?.toFixed(1)} (
            {vendor.ratingCount} {bn ? "রিভিউ" : "reviews"})
          </>
        ) : null}
      </p>
      <p style={{ whiteSpace: "pre-line" }}>{vendor.description}</p>
      <h2>{bn ? "সেবাসমূহ" : "Services"}</h2>
      <ul className="meal-list">
        {vendor.services.map((s) => (
          <li key={s.id}>
            <span>
              {s.title}
              {s.capacity
                ? ` · ${bn ? "সর্বোচ্চ" : "up to"} ${s.capacity} ${bn ? "অতিথি" : "guests"}`
                : ""}
            </span>
            <strong>
              {bn ? "শুরু" : "from"} {taka(s.basePriceMinor)}
            </strong>
          </li>
        ))}
      </ul>
      <Link className="button primary" href={`/signup?vendor=${vendor.slug}`}>
        {bn ? "আপনার তারিখ সম্পর্কে জানতে চান" : "Ask about your date"}
      </Link>
      {vendor.gallery?.length ? (
        <>
          <h2>{bn ? "কাজের নমুনা" : "Portfolio"}</h2>
          <div className="photo-grid">
            {vendor.gallery.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${vendor.businessName} ${bn ? "এর কাজ" : "work"}`}
                loading="lazy"
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      {reviews.length > 0 && (
        <>
          <h2>{bn ? "রিভিউ" : "Reviews"}</h2>
          {reviews.map((r) => (
            <article
              key={r.id}
              className="side-card"
              style={{ marginBottom: 12 }}
            >
              <strong>{"★".repeat(r.rating)}</strong>
              <p>{r.body}</p>
              {r.reply && (
                <p className="muted">
                  {bn ? "উত্তর" : "Reply from"} {vendor.businessName}: {r.reply}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
