import { buildApp } from "./app";
import { config } from "./config";
import { logger } from "@360crd/logger";
import redis from "@360crd/cache";
import { basePrisma } from "@360crd/database";
import { queueManager } from "@360crd/queue";
import { startWorkers } from "./workers";

async function bootstrap(): Promise<void> {
  // ── Connect Redis ─────────────────────────────────────────────────────
  try {
    await redis.connect();
    logger.info("Redis connected");
  } catch (err) {
    logger.error("Redis connection failed", { error: (err as Error).message });
    process.exit(1);
  }

  // ── Connect Postgres ──────────────────────────────────────────────────
  try {
    await basePrisma.$connect();
    logger.info("PostgreSQL connected");
  } catch (err) {
    logger.error("Database connection failed", { error: (err as Error).message });
    process.exit(1);
  }

  // ── Start BullMQ workers ──────────────────────────────────────────────
  const workers = startWorkers();
  workers.forEach((w) => queueManager.registerWorker(w));
  logger.info(`Started ${workers.length} queue workers`);

  // ── Build Fastify app ─────────────────────────────────────────────────
  const app = await buildApp();

  // ── Start server ──────────────────────────────────────────────────────
  try {
    const address = await app.listen({
      port: config.server.port,
      host: config.server.host,
    });
    logger.info(`Server listening at ${address}`);
    logger.info(`Environment: ${config.env}`);

    if (!config.isProduction) {
      logger.info(`API Docs: ${address}/docs`);
    }
  } catch (err) {
    logger.error("Failed to start server", { error: (err as Error).message });
    process.exit(1);
  }

  // ── Graceful shutdown ─────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      await queueManager.closeAll();
      await basePrisma.$disconnect();
      await redis.quit();
      logger.info("Graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", { error: (err as Error).message });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", { error: err.message, stack: err.stack });
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { reason });
    process.exit(1);
  });
}

bootstrap();
