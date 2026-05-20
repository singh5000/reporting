import { Queue, Worker, QueueEvents, type ConnectionOptions } from "bullmq";
import type { EmailJob, NotificationJob, ReportJob } from "@360crd/shared-types";

// ── Redis connection ────────────────────────────────────────────────────────
const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
};

// ── Queue names ─────────────────────────────────────────────────────────────
export const QUEUES = {
  EMAIL: "email",
  NOTIFICATION: "notification",
  REPORT: "report",
  WEBHOOK: "webhook",
  AUDIT_LOG: "audit-log",
  CLEANUP: "cleanup",
} as const;

// ── Default job options ─────────────────────────────────────────────────────
const defaultJobOptions = {
  attempts: parseInt(process.env.QUEUE_MAX_RETRIES || "3", 10),
  backoff: {
    type: "exponential" as const,
    delay: parseInt(process.env.QUEUE_RETRY_DELAY_MS || "5000", 10),
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

// ── Queue factory ───────────────────────────────────────────────────────────
function createQueue<T>(name: string) {
  return new Queue<T>(name, {
    connection: redisConnection,
    defaultJobOptions,
  });
}

// ── Queues ──────────────────────────────────────────────────────────────────
export const emailQueue = createQueue<EmailJob>(QUEUES.EMAIL);
export const notificationQueue = createQueue<NotificationJob>(QUEUES.NOTIFICATION);
export const reportQueue = createQueue<ReportJob>(QUEUES.REPORT);
export const webhookQueue = createQueue<{ webhookId?: string; tenantId: string; event: string; payload: unknown }>(QUEUES.WEBHOOK);
export const auditLogQueue = createQueue<{ entry: unknown }>(QUEUES.AUDIT_LOG);
export const cleanupQueue = createQueue<{ task: string; params?: unknown }>(QUEUES.CLEANUP);

// ── Queue Events (for monitoring) ───────────────────────────────────────────
export const emailQueueEvents = new QueueEvents(QUEUES.EMAIL, { connection: redisConnection });
export const notificationQueueEvents = new QueueEvents(QUEUES.NOTIFICATION, { connection: redisConnection });

// ── Worker factory ──────────────────────────────────────────────────────────
export function createWorker<T>(
  queueName: string,
  processor: (job: import("bullmq").Job<T>) => Promise<unknown>,
  options?: { concurrency?: number }
) {
  const worker = new Worker<T>(queueName, processor, {
    connection: redisConnection,
    concurrency: options?.concurrency || parseInt(process.env.QUEUE_CONCURRENCY || "5", 10),
  });

  worker.on("failed", (job, err) => {
    console.error(`[Queue:${queueName}] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[Queue:${queueName}] Worker error:`, err.message);
  });

  return worker;
}

// ── Queue manager for graceful shutdown ─────────────────────────────────────
export class QueueManager {
  private queues = [emailQueue, notificationQueue, reportQueue, webhookQueue, auditLogQueue, cleanupQueue];
  private workers: import("bullmq").Worker[] = [];

  registerWorker(worker: import("bullmq").Worker) {
    this.workers.push(worker);
  }

  async closeAll(): Promise<void> {
    await Promise.all([
      ...this.workers.map((w) => w.close()),
      ...this.queues.map((q) => q.close()),
    ]);
  }
}

export const queueManager = new QueueManager();
export { redisConnection };
