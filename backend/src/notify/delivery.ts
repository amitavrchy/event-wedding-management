import { Logger } from "@nestjs/common";
import type { PrismaClient } from "@prisma/client";
import { PermanentDeliveryError, sendEmail, sendPush, sendSms } from "./channels";

const logger = new Logger("Outbox");
const MAX_ATTEMPTS = 5;

/**
 * Delivers queued outbound messages. Safe to run concurrently: each row is
 * claimed with a conditional update before it is sent.
 */
export async function deliverPending(db: PrismaClient, limit = 50) {
  const due = await db.outboundMessage.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let sent = 0;
  for (const message of due) {
    const claimed = await db.outboundMessage.updateMany({
      where: { id: message.id, status: "PENDING" },
      data: { status: "SENDING", attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;
    try {
      await deliver(db, message);
      await db.outboundMessage.update({
        where: { id: message.id },
        data: { status: "SENT", sentAt: new Date(), lastError: null },
      });
      sent++;
    } catch (error) {
      const attempts = message.attempts + 1;
      const permanent = error instanceof PermanentDeliveryError || attempts >= MAX_ATTEMPTS;
      // Exponential backoff: 1, 4, 16, 64 minutes.
      const delay = 60000 * 4 ** (attempts - 1);
      await db.outboundMessage.update({
        where: { id: message.id },
        data: {
          status: permanent ? "FAILED" : "PENDING",
          lastError: (error as Error).message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + delay),
        },
      });
      logger.warn(`${message.channel} ${message.id} attempt ${attempts} failed: ${(error as Error).message}`);
    }
  }
  return sent;
}

async function deliver(
  db: PrismaClient,
  message: { channel: string; recipient: string; subject: string | null; body: string; data: unknown; userId: string | null },
) {
  const data = (message.data || {}) as Record<string, string>;
  if (message.channel === "EMAIL")
    return sendEmail({ to: message.recipient, subject: message.subject || "Ayojon", text: message.body, html: data.html });
  if (message.channel === "SMS") return sendSms(message.recipient, message.body);
  if (message.channel === "PUSH") {
    // recipient is a userId: fan out to every registered device.
    const devices = await db.deviceToken.findMany({ where: { userId: message.recipient } });
    const { html: _html, ...payload } = data;
    for (const device of devices) {
      const valid = await sendPush({
        token: device.token,
        title: message.subject || "Ayojon",
        body: message.body,
        data: payload,
      });
      if (!valid) await db.deviceToken.delete({ where: { id: device.id } }).catch(() => undefined);
    }
    return;
  }
  throw new PermanentDeliveryError(`Unknown channel ${message.channel}`);
}
