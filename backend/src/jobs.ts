import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { writeFile } from "node:fs/promises";
import { Queue, Worker } from "bullmq";
import { Database } from "./prisma";
import { createReminders } from "./reminders";
import { executeAutomations } from "./automations";
import { deliverPending } from "./notify/delivery";
import { maintainSubscriptions } from "./subscriptions";
import { inquiryFollowUps } from "./marketplace";
import { sendMonthlyReports } from "./day-of";

import { HEARTBEAT_FILE } from "./config";
import { redisConnection } from "./redis";


/** Runs one maintenance pass. Exported for tests and for the inline fallback. */
export async function maintenance(db: Database) {
  await db.booking.updateMany({
    where: {
      status: { in: ["HELD", "AWAITING_ADVANCE"] },
      holdExpiresAt: { lte: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  await db.quote.updateMany({
    where: { status: "SENT", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  await createReminders(db);
  await executeAutomations(db);
  await maintainSubscriptions(db);
  await inquiryFollowUps(db);
  await sendMonthlyReports(db);
}

/**
 * Background jobs. The API process enqueues work; a worker process runs it.
 * - RUN_WORKER=false (production API container): queue only, no worker.
 * - otherwise (local development, the worker container): queue and worker.
 */
@Injectable()
export class Jobs implements OnModuleInit, OnModuleDestroy {
  private logger = new Logger("Jobs");
  private queue?: Queue;
  private workers: Worker[] = [];
  lastRunAt?: Date;
  constructor(private db: Database) {}

  get runsWorker() {
    return process.env.RUN_WORKER !== "false";
  }

  async onModuleInit() {
    const connection = redisConnection();
    if (!connection) return;
    this.queue = new Queue("utsab-maintenance", { connection });
    if (!this.runsWorker) return;
    const maintenanceWorker = new Worker(
      "utsab-maintenance",
      async (job) => {
        if (job.name === "deliver-notifications") return deliverPending(this.db);
        await maintenance(this.db);
        await deliverPending(this.db);
        this.lastRunAt = new Date();
        await writeFile(HEARTBEAT_FILE, String(Math.floor(Date.now() / 1000))).catch(() => undefined);
      },
      { connection, concurrency: 1 },
    );
    maintenanceWorker.on("error", (err) => this.logger.error(`Worker: ${err.message}`));
    this.workers.push(maintenanceWorker);
    await this.queue.upsertJobScheduler(
      "minute-maintenance",
      { every: 60000 },
      { name: "expire-holds-and-quotes", data: {} },
    );
  }

  async status() {
    if (!this.queue) return { queue: "disabled" as const };
    try {
      await this.queue.getJobCounts("waiting");
      return { queue: "ok" as const, worker: this.runsWorker ? "in-process" : "separate" };
    } catch {
      return { queue: "unreachable" as const };
    }
  }

  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.queue?.close();
  }
}
