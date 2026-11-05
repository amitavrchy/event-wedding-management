import { BadRequestException, ConflictException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { activeStatuses } from "./domain";
export async function reserve(
  tx: Prisma.TransactionClient,
  data: {
    eventId: string;
    serviceId: string;
    startAt: string;
    policyFlags: string[];
  },
  discountBps = 0,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.serviceId}))`;
  const service = await tx.vendorService.findUnique({
    where: { id: data.serviceId },
    include: { vendor: true },
  });
  if (!service || service.vendor.status !== "ACTIVE")
    throw new BadRequestException("Service is unavailable");
  const startAt = new Date(data.startAt);
  if (startAt <= new Date())
    throw new BadRequestException("Choose a future date");
  const endAt = new Date(+startAt + service.durationHours * 3600000),
    reservedUntil = new Date(+endAt + service.bufferHours * 3600000);
  await tx.booking.updateMany({
    where: {
      serviceId: data.serviceId,
      status: { in: ["HELD", "AWAITING_ADVANCE"] },
      holdExpiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  const conflict = await tx.booking.findFirst({
    where: {
      serviceId: data.serviceId,
      status: { in: activeStatuses },
      startAt: { lt: reservedUntil },
      reservedUntil: { gt: startAt },
    },
  });
  const blocked = await tx.availabilityBlock.findFirst({
    where: {
      serviceId: data.serviceId,
      startAt: { lt: reservedUntil },
      endAt: { gt: startAt },
    },
  });
  if (conflict || blocked)
    throw new ConflictException(
      `${service.title} is already reserved for that time`,
    );
  const priceMinor = Math.round(
    (service.basePriceMinor * (10000 - discountBps)) / 10000,
  );
  return tx.booking.create({
    data: {
      ...data,
      vendorId: service.vendorId,
      category: service.vendor.category,
      startAt,
      endAt,
      reservedUntil,
      priceMinor,
      advanceMinor: Math.ceil(priceMinor * 0.3),
      holdExpiresAt: new Date(Date.now() + 15 * 60000),
    },
  });
}
