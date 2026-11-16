import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/app/tools.css";
import { serverApi, siteUrl } from "@/lib/server-api";
import { PublicVendorProfile } from "@/components/public-vendor-profile";
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
    <PublicVendorProfile vendor={vendor} reviews={reviews} jsonLd={jsonLd} />
  );
}
