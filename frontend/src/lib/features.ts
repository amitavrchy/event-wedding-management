import type { Event, Feature, FeatureCatalog, User } from "./types";

/**
 * Occasion-driven navigation. The API decides which tools an event shows
 * (core + occasion defaults + the host's own additions); the web only renders
 * what the event allows. Pages that are not tools (overview, settings,
 * account, notifications) are always reachable.
 */
const ALWAYS = [
  "/dashboard",
  "/settings",
  "/account",
  "/notifications",
  "/messages",
  "/planning",
  "/invite",
];
const VENDOR_ONLY = ["/business", "/studio", "/availability"];
const ADMIN_ONLY = ["/admin"];

export const basePath = (path: string) => path.split("?")[0];

export function featureForPath(
  path: string,
  catalog: FeatureCatalog | null,
): Feature | undefined {
  if (!catalog) return undefined;
  const target = basePath(path);
  // Several tools can share a page (e.g. guests?view=sides); the page itself
  // belongs to the tool whose path has no query.
  return (
    catalog.features.find((f) => f.path === target) ||
    catalog.features.find((f) => basePath(f.path) === target)
  );
}

/** Whether the current user may open this path for the selected event. */
export function pathAllowed(
  path: string,
  user: User | null,
  event: Event | null,
  catalog: FeatureCatalog | null,
) {
  const target = basePath(path);
  if (ALWAYS.includes(target)) return true;
  if (VENDOR_ONLY.includes(target))
    return user?.role === "VENDOR" || user?.role === "PLATFORM_ADMIN";
  if (ADMIN_ONLY.includes(target)) return user?.role === "PLATFORM_ADMIN";
  if (user?.role === "VENDOR")
    return (
      vendorNavigation.some((item) => item.path === target) ||
      target === "/vendors"
    );
  const feature = featureForPath(target, catalog);
  if (!feature) return true;
  if (!event) return Boolean(feature.core);
  return (
    (event.features || []).includes(feature.key) ||
    catalog!.features.some(
      (f) =>
        basePath(f.path) === target && (event.features || []).includes(f.key),
    )
  );
}

export type NavGroup = { key: string; label: string; items: Feature[] };

/** Navigation for a host workspace, grouped, containing only the event's tools. */
export function hostNavigation(
  event: Event | null,
  catalog: FeatureCatalog | null,
  locale: "en" | "bn" = "en",
): NavGroup[] {
  if (!catalog) return [];
  const enabled = new Set(
    event?.features || catalog.features.filter((f) => f.core).map((f) => f.key),
  );
  return catalog.groups
    .map((group) => ({
      key: group.key,
      label: locale === "bn" ? group.labelBn : group.label,
      items: catalog.features.filter(
        (f) => f.group === group.key && enabled.has(f.key),
      ),
    }))
    .filter((group) => group.items.length);
}

export const vendorNavigation = [
  { path: "/business", label: "Leads & pipeline" },
  { path: "/studio", label: "Profile & services" },
  { path: "/availability", label: "Calendar" },
  { path: "/packages", label: "Packages & quotes" },
  { path: "/bookings", label: "Bookings" },
  { path: "/contracts", label: "Agreements" },
  { path: "/finance", label: "Payments" },
  { path: "/insights", label: "Insights" },
];
