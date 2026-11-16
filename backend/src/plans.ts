import { Database } from "./prisma";

export type Entitlements = {
  maxPhotos: number;
  maxServices: number;
  /** Eligible for limited, clearly labelled sponsored placement. */
  featured: boolean;
  /** Ranking boost inside organic results (never hides better matches). */
  priority: number;
};

/** What a vendor gets without a paid plan. */
export const FREE: Entitlements = { maxPhotos: 6, maxServices: 3, featured: false, priority: 0 };

/** Entitlements of the vendor's active plan, or the free tier. */
export async function entitlements(db: Database, vendor: { planCode: string | null }): Promise<Entitlements> {
  if (!vendor.planCode) return FREE;
  const plan = await db.plan.findUnique({ where: { code: vendor.planCode } });
  return plan ? { ...FREE, ...(plan.entitlements as Partial<Entitlements>) } : FREE;
}
