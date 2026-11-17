"use client";
import { MapPin, ArrowUpRight, Star, BadgeCheck } from "lucide-react";
import "@/app/tools.css";
import { Vendor } from "@/lib/types";
import { usePublicLocale } from "@/lib/public-i18n";
import { taka } from "@/lib/format";

export function VendorCard({
  vendor,
  onSelect,
}: {
  vendor: Vendor;
  onSelect: (vendor: Vendor) => void;
}) {
  const { locale } = usePublicLocale();
  const bn = locale === "bn";
  const prices = vendor.services.map((s) => s.basePriceMinor);
  const price =
    vendor.priceFromMinor ?? (prices.length ? Math.min(...prices) : NaN);
  return (
    <button className="vendor-card" onClick={() => onSelect(vendor)}>
      <div
        className="vendor-image"
        style={{ backgroundImage: `url("${vendor.image}")` }}
      >
        <span className="image-pill">{vendor.category}</span>
        {vendor.sponsored && (
          <span className="image-pill badge-sponsored sponsored-pill">
            {bn ? "স্পন্সর করা" : "Sponsored"}
          </span>
        )}
        <span className="vendor-open">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="vendor-body">
        <div className="vendor-title">
          <h3>{vendor.businessName}</h3>
          {vendor.verified && (
            <span
              className="verified"
              title={
                bn
                  ? "আমাদের দল নথি যাচাই করেছে"
                  : "Documents verified by our team"
              }
            >
              <BadgeCheck size={16} />
            </span>
          )}
        </div>
        <span className="vendor-city">
          <MapPin size={14} />
          {vendor.city}
          {vendor.ratingCount ? (
            <span className="vendor-rating">
              <Star size={13} /> {vendor.ratingAvg?.toFixed(1)} (
              {vendor.ratingCount})
            </span>
          ) : null}
        </span>
        <div className="vendor-price">
          <span>{bn ? "শুরু" : "Starting from"}</span>
          <strong>
            {Number.isFinite(price)
              ? taka(price)
              : bn
                ? "মূল্য জানতে চান"
                : "Ask for a quote"}
          </strong>
        </div>
      </div>
    </button>
  );
}
