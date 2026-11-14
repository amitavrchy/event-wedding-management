import "reflect-metadata";
import "dotenv/config";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Database } from "./prisma";
import { Jobs } from "./jobs";

/**
 * Standalone background worker (production `worker` container).
 * Runs maintenance every minute and delivers queued notifications.
 */
@Module({ providers: [Database, Jobs] })
class WorkerModule {}

async function main() {
  if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required for the worker");
  process.env.RUN_WORKER = "true";
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  console.log("Worker started");
}
void main();
