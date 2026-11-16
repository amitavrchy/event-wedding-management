import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Database } from "../prisma";
import { redisConnection } from "../redis";
import { deliverPending } from "./delivery";

/**
 * Asks for queued notifications to be delivered now. With Redis the worker
 * picks the job up (and sweeps every minute). Without Redis (local
 * development, tests) delivery runs in this process: one run at a time, a
 * follow-up run if more work arrived meanwhile, and a sweep every few seconds
 * so a failed run never strands a message. Kept separate from Jobs to avoid
 * an import cycle with the controllers.
 */
@Injectable()
export class DeliveryQueue implements OnModuleDestroy {
  private logger = new Logger("DeliveryQueue");
  private queue?: Queue;
  private running = false;
  private again = false;
  private sweep?: ReturnType<typeof setInterval>;

  constructor(private db: Database) {
    const connection = redisConnection();
    if (connection) this.queue = new Queue("utsab-maintenance", { connection });
    else {
      this.sweep = setInterval(() => void this.runLocal(), 5000);
      this.sweep.unref();
    }
  }

  async kick() {
    if (this.queue) {
      await this.queue.add("deliver-notifications", {}, { removeOnComplete: 100, removeOnFail: 100 });
      return;
    }
    setImmediate(() => void this.runLocal());
  }

  private async runLocal() {
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    try {
      do {
        this.again = false;
        await deliverPending(this.db);
      } while (this.again);
    } catch (error) {
      this.logger.error(`Local delivery failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  async onModuleDestroy() {
    if (this.sweep) clearInterval(this.sweep);
    await this.queue?.close();
  }
}
