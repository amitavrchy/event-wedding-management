import type { MetadataRoute } from "next";
import { serverApi, siteUrl } from "@/lib/server-api";

/** Public pages and every active vendor profile (first 1,000). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    "",
    "/terms",
    "/privacy",
    "/refund-policy",
  ].map((path) => ({ url: `${base}${path}` }));
  const vendors: MetadataRoute.Sitemap = [];
  for (let page = 1; page <= 17; page++) {
    const result = await serverApi<{
      items: { slug: string }[];
      pages: number;
    }>(`vendors?limit=60&page=${page}`, 3600);
    if (!result) break;
    vendors.push(
      ...result.items.map((v) => ({
        url: `${base}/v/${v.slug}`,
        changeFrequency: "weekly" as const,
      })),
    );
    if (page >= result.pages) break;
  }
  return [...pages, ...vendors];
}
