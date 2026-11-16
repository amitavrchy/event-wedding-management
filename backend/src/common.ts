import { ForbiddenException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Database } from "./prisma";
import { parse, z } from "./validation";

/** `?page=1&limit=20` → Prisma skip/take plus a response wrapper. */
export function pagination(query: unknown, defaults = { limit: 20, max: 100 }) {
  const q = parse(
    z.object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      limit: z.coerce.number().int().min(1).max(defaults.max).default(defaults.limit),
    }),
    query ?? {},
  );
  return {
    page: q.page,
    limit: q.limit,
    skip: (q.page - 1) * q.limit,
    take: q.limit,
    wrap<T>(items: T[], total: number) {
      return { items, total, page: q.page, limit: q.limit, pages: Math.max(1, Math.ceil(total / q.limit)) };
    },
  };
}

export function requireAdmin(req: { user?: { role?: string } }) {
  if (req.user?.role !== "PLATFORM_ADMIN") throw new ForbiddenException("Administrator access required");
}

/** Records an administrative action. Never throws: auditing must not block the action. */
export async function audit(
  db: Database | Prisma.TransactionClient,
  req: { user: { sub: string; role: string }; ip?: string },
  action: string,
  targetType: string,
  targetId: string,
  detail?: Record<string, unknown>,
) {
  try {
    await db.auditLog.create({
      data: {
        actorId: req.user.sub,
        actorRole: req.user.role,
        action,
        targetType,
        targetId,
        detail: (detail ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: req.ip,
      },
    });
  } catch {
    /* ignore */
  }
}

/** Notifies every platform administrator (in-app + push). */
export async function adminIds(db: Database) {
  const admins = await db.user.findMany({ where: { role: "PLATFORM_ADMIN", deletedAt: null }, select: { id: true } });
  return admins.map((a) => a.id);
}

export function csv(rows: Record<string, unknown>[], columns: string[]) {
  const escape = (value: unknown) => {
    const text = value instanceof Date ? value.toISOString() : typeof value === "object" && value ? JSON.stringify(value) : String(value ?? "");
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => escape(row[c])).join(","))].join("\n");
}
