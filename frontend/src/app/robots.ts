import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server-api";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/v/"],
        disallow: [
          "/api/",
          "/rsvp/",
          "/photos/",
          "/day-of/",
          "/invite/",
          "/receipts/",
          "/quotes/",
        ],
      },
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
