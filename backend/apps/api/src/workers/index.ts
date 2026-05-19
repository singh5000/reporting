import { createEmailWorker } from "./email.worker";
import { createNotificationWorker } from "./notification.worker";
import { createWebhookWorker } from "./webhook.worker";
import { createReportWorker } from "./report.worker";
import type { Worker } from "bullmq";

export function startWorkers(): Worker[] {
  return [
    createEmailWorker(),
    createNotificationWorker(),
    createWebhookWorker(),
    createReportWorker(),
  ];
}
