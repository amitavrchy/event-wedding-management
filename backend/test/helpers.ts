import { after } from "node:test";
import { Database } from "../src/prisma";
import { Notifier } from "../src/notify/notifier";
import { DeliveryQueue } from "../src/notify/queue";
import { limiter } from "../src/rate-limit";

const queues: DeliveryQueue[] = [];

/**
 * A real Notifier for controller-level tests (console delivery drivers).
 * With REDIS_URL set the DeliveryQueue opens a BullMQ connection; Nest closes it
 * on shutdown, so tests that build controllers by hand must close it too or the
 * test process never exits.
 */
export const notifierFor = (db: Database) => {
  const queue = new DeliveryQueue(db);
  queues.push(queue);
  return new Notifier(db, queue);
};

/**
 * Release the Redis connections Nest would close on shutdown: delivery queues
 * built above and the shared rate limiter (opened when websites or guest pages
 * are imported). Closing twice is harmless when a test also closes its app.
 */
after(async () => {
  await Promise.all(queues.splice(0).map((queue) => queue.onModuleDestroy()));
  await limiter.close();
});
