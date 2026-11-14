import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Database } from "../prisma";
import { DeliveryQueue } from "./queue";
import { publishToUser } from "../realtime";
import { channelConfigured } from "./channels";
import { render } from "./templates";

type Channels = { push?: boolean; email?: boolean; sms?: boolean };

export type NotifyInput = {
  title: string;
  body: string;
  link?: string;
  kind?: string;
  /** Idempotency key: the same key never produces a second notification. */
  key?: string;
  channels?: Channels;
};

/**
 * Records an in-app notification and queues push / email / SMS rows.
 * Returns the notification and whether outbound rows were queued.
 * Usable from the API (via Notifier) and from the worker directly.
 */
export async function recordNotification(db: PrismaClient, userId: string, input: NotifyInput) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return { notification: null, queued: false };
  const key = input.key || `${input.kind || "INFO"}:${randomUUID()}`;
  const existing = await db.notification.findUnique({ where: { key } });
  if (existing) return { notification: existing, queued: false };
  const notification = await db.notification.create({
    data: { key, recipientId: userId, title: input.title, body: input.body, kind: input.kind || "INFO", link: input.link },
  });
  publishToUser(userId, "notification", notification);
  const channels = { push: true, ...input.channels };
  const rows: { userId: string; channel: string; recipient: string; subject: string; body: string; data?: object }[] = [];
  if (channels.push && channelConfigured("PUSH"))
    rows.push({
      userId,
      channel: "PUSH",
      recipient: userId,
      subject: input.title,
      body: input.body,
      data: { link: input.link || "", kind: notification.kind, notificationId: notification.id },
    });
  if (channels.email && user.emailVerifiedAt && channelConfigured("EMAIL"))
    rows.push({
      userId,
      channel: "EMAIL",
      recipient: user.email,
      subject: input.title,
      body: input.link ? `${input.body}\n\n${input.link}` : input.body,
    });
  if (channels.sms && user.phone && user.phoneVerifiedAt && channelConfigured("SMS"))
    rows.push({ userId, channel: "SMS", recipient: user.phone, subject: input.title, body: input.body });
  if (rows.length) await db.outboundMessage.createMany({ data: rows });
  return { notification, queued: rows.length > 0 };
}

/**
 * One entry point for telling a user something. It always records an in-app
 * notification, then queues push / email / SMS according to what the user has
 * verified and what is configured. Delivery happens in the worker.
 */
@Injectable()
export class Notifier {
  constructor(
    private db: Database,
    private delivery: DeliveryQueue,
  ) {}

  async notify(userId: string, input: NotifyInput) {
    const result = await recordNotification(this.db, userId, input);
    if (result.queued) await this.delivery.kick();
    return result.notification;
  }

  /** Notify using a translated template in the recipient's language. */
  async notifyTemplate(
    userId: string,
    template: Parameters<typeof render>[0],
    vars: Record<string, string | number>,
    options: { link?: string; kind?: string; key?: string; channels?: Channels } = {},
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { locale: true } });
    const message = render(template, user?.locale || "en", { link: options.link || "", ...vars });
    return this.notify(userId, { title: message.subject, body: message.body, ...options });
  }

  /** Send directly to an address that is not yet verified (verification, reset). */
  async direct(channel: "EMAIL" | "SMS", recipient: string, subject: string, body: string, userId?: string) {
    await this.db.outboundMessage.create({
      data: { userId, channel, recipient, subject, body },
    });
    await this.delivery.kick();
  }
}
