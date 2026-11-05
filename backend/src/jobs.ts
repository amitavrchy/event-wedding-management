import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { Database } from "./prisma";
import { createReminders } from "./reminders";
import { executeAutomations } from "./automations";
@Injectable()
export class Jobs implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  constructor(private db: Database) {}
  async onModuleInit() {
    if (!process.env.REDIS_URL) return;
    const url = new URL(process.env.REDIS_URL);
    const connection = {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue("utsab-maintenance", { connection });
    this.worker = new Worker(
      "utsab-maintenance",
      async () => {
        await this.db.booking.updateMany({
          where: {
            status: { in: ["HELD", "AWAITING_ADVANCE"] },
            holdExpiresAt: { lte: new Date() },
          },
          data: { status: "EXPIRED" },
        });
        await this.db.quote.updateMany({
          where: { status: "SENT", expiresAt: { lte: new Date() } },
          data: { status: "EXPIRED" },
        });
        await createReminders(this.db);
        await executeAutomations(this.db);
      },
      { connection },
    );
    this.worker.on("error", (err) =>
      console.error("Maintenance worker:", err.message),
    );
    await this.queue.upsertJobScheduler(
      "minute-maintenance",
      { every: 60000 },
      { name: "expire-holds-and-quotes", data: {} },
    );
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
