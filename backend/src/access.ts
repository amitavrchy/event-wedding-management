import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Database } from "./prisma";
import { Identity } from "./auth";
export async function ownEvent(
  db: Database,
  id: string,
  user: Identity,
  permission: "read" | "write" = "write",
) {
  const event = await db.event.findUnique({ where: { id } });
  let access = "OWNER";
  if (!event) throw new NotFoundException("Event not found");
  if (event.hostId !== user.sub && user.role !== "PLATFORM_ADMIN") {
    const member = await db.eventMember.findUnique({
      where: { eventId_userId: { eventId: id, userId: user.sub } },
    });
    if (
      !member ||
      member.expiresAt < new Date() ||
      (permission === "write" && member.permission !== "EDITOR")
    )
      throw new ForbiddenException(
        "This workspace is outside your permissions",
      );
    access = member.permission;
  }
  return { ...event, access };
}
export async function ownVendor(
  db: Database,
  id: string,
  user: Identity,
  permission: "read" | "write" = "write",
) {
  const vendor = await db.vendor.findUnique({ where: { id } });
  if (!vendor) throw new NotFoundException("Vendor not found");
  if (vendor.ownerId !== user.sub && user.role !== "PLATFORM_ADMIN") {
    const member = await db.vendorMember.findUnique({
      where: { vendorId_userId: { vendorId: id, userId: user.sub } },
    });
    if (
      !member ||
      member.expiresAt < new Date() ||
      (permission === "write" && member.permission !== "MANAGER")
    )
      throw new ForbiddenException("This business is outside your permissions");
  }
  return vendor;
}
export const eventAccess = (userId: string) => ({
  OR: [
    { hostId: userId },
    { members: { some: { userId, expiresAt: { gt: new Date() } } } },
  ],
});
export const vendorAccess = (userId: string) => ({
  OR: [
    { ownerId: userId },
    { members: { some: { userId, expiresAt: { gt: new Date() } } } },
  ],
});
