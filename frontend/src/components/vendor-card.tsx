"use client";
import { MapPin, ArrowUpRight } from "lucide-react";
import { Vendor } from "@/lib/types";
import { taka } from "@/lib/format";
export function VendorCard({
  vendor,
  onSelect,
}: {
  vendor: Vendor;
  onSelect: (vendor: Vendor) => void;
}) {
  const price = Math.min(...vendor.services.map((s) => s.basePriceMinor));
  return (
    <button className="vendor-card" onClick={() => onSelect(vendor)}>
      <div
        className="vendor-image"
        style={{ backgroundImage: `url("${vendor.image}")` }}
      >
        <span className="image-pill">{vendor.category}</span>
        <span className="vendor-open">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="vendor-body">
        <div className="vendor-title">
          <h3>{vendor.businessName}</h3>
          <span className="verified" title="Active marketplace vendor">
            ✓
          </span>
        </div>
        <span className="vendor-city">
          <MapPin size={14} />
          {vendor.city}, Bangladesh
        </span>
        <div className="vendor-price">
          <span>Starting from</span>
          <strong>
            {Number.isFinite(price) ? taka(price) : "Ask for a quote"}
          </strong>
        </div>
      </div>
    </button>
  );
}
