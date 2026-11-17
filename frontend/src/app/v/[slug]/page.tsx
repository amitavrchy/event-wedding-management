import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import "@/app/tools.css";
import { serverApi, siteUrl } from "@/lib/server-api";
import { taka } from "@/lib/format";
import type { Vendor } from "@/lib/types";

type Review = {
  id: string;
  rating: number;
  body: string;
  reply?: string;
  createdAt: string;
};
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const vendor = await serverApi<Vendor>(`vendors/${encodeURIComponent(slug)}`);
  if (!vendor) return { title: "Vendor not found" };
  const description =
    `${vendor.category} in ${vendor.city}. ${vendor.description}`.slice(0, 160);
  return {
    title: `${vendor.businessName} · ${vendor.category} in ${vendor.city}`,
    description,
    alternates: { canonical: `${siteUrl()}/v/${vendor.slug}` },
    openGraph: {
      title: vendor.businessName,
      description,
      images: vendor.image ? [vendor.image] : [],
      type: "profile",
    },
  };
}

/** Public, shareable vendor profile (vendors link it from their Facebook pages). */
export default async function VendorProfile({ params }: Props) {
  const { slug } = await params;
  const vendor = await serverApi<Vendor>(`vendors/${encodeURIComponent(slug)}`);
  if (!vendor) notFound();
  const reviews =
    (await serverApi<Review[]>(`vendors/${vendor.id}/reviews`)) || [];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: vendor.businessName,
    description: vendor.description,
    image: vendor.image,
    address: {
      "@type": "PostalAddress",
      addressLocality: vendor.city,
      addressCountry: "BD",
    },
    ...(vendor.ratingCount
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: vendor.ratingAvg,
            reviewCount: vendor.ratingCount,
          },
        }
      : {}),
  };
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
        {vendor.verified && <BadgeCheck size={22} aria-label="Verified" />}
      </h1>
      <p className="muted">
        <MapPin size={15} /> {vendor.category} · {vendor.city}
        {vendor.serviceAreas?.length
          ? ` · serves ${vendor.serviceAreas.join(", ")}`
          : ""}
        {vendor.ratingCount ? (
          <>
            {" "}
            · <Star size={14} /> {vendor.ratingAvg?.toFixed(1)} (
            {vendor.ratingCount} reviews)
          </>
        ) : null}
      </p>
      <p style={{ whiteSpace: "pre-line" }}>{vendor.description}</p>
      <h2>Services</h2>
      <ul className="meal-list">
        {vendor.services.map((s) => (
          <li key={s.id}>
            <span>
              {s.title}
              {s.capacity ? ` · up to ${s.capacity} guests` : ""}
            </span>
            <strong>from {taka(s.basePriceMinor)}</strong>
          </li>
        ))}
      </ul>
      <Link className="button primary" href={`/signup?vendor=${vendor.slug}`}>
        Ask about your date
      </Link>
      {vendor.gallery?.length ? (
        <>
          <h2>Portfolio</h2>
          <div className="photo-grid">
            {vendor.gallery.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${vendor.businessName} work`}
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
          <h2>Reviews</h2>
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
                  Reply from {vendor.businessName}: {r.reply}
                </p>
              )}
            </article>
          ))}
        </>
      )}
    </main>
  );
}
