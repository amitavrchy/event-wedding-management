import { Database } from "../src/prisma";
import { Notifier } from "../src/notify/notifier";
import { DeliveryQueue } from "../src/notify/queue";

/** A real Notifier for controller-level tests (console delivery drivers). */
export const notifierFor = (db: Database) => new Notifier(db, new DeliveryQueue(db));
