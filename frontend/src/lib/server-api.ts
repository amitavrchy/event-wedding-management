/** Server-side API read (public endpoints only). Used for SEO pages. */
export async function serverApi<T>(
  path: string,
  revalidate = 300,
): Promise<T | null> {
  const base = process.env.API_URL || "http://localhost:4000";
  try {
    const response = await fetch(`${base}/api/${path}`, {
      next: { revalidate },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
export const siteUrl = () =>
  (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
