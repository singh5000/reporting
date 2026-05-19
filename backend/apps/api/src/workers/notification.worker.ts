import type { Job } from "bullmq";
import { createWorker } from "@360crd/queue";
import { basePrisma } from "@360crd/database";
import type { NotificationJob } from "@360crd/shared-types";
import { broadcastToUser } from "../plugins/websocket.plugin";
import { logger } from "@360crd/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Worker — processes notification queue jobs
// Dispatches to: in-app (WebSocket), email, push (FCM/APNs)
// ─────────────────────────────────────────────────────────────────────────────
export function createNotificationWorker() {
  return createWorker<NotificationJob>("notification", async (job: Job<NotificationJob>) => {
    const { tenantId, userId, type, title, message, channel, data } = job.data;

    logger.info("Processing notification job", { jobId: job.id, userId, channel, type });

    // Persist notification to DB
    const notification = await basePrisma.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title,
        message,
        channel,
        status: "PENDING",
        data: data as any,
      },
    });

    try {
      switch (channel) {
        case "in-app":
          await deliverInApp(userId, notification);
          break;
        case "push":
          await deliverPush(userId, notification, job.data.pushToken);
          break;
        case "email":
          // Re-queue to email worker
          const { emailQueue } = await import("@360crd/queue");
          const user = await basePrisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true },
          });
          if (user) {
            await emailQueue.add("notification-email", {
              to: user.email,
              subject: title,
              htmlBody: `<p>Hello ${user.firstName},</p><p>${message}</p>`,
              tenantId,
            });
          }
          break;
      }

      await basePrisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });

      logger.info("Notification delivered", { jobId: job.id, notificationId: notification.id });
    } catch (err) {
      await basePrisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED", failedAt: new Date(), error: (err as Error).message },
      });
      throw err;
    }
  }, { concurrency: 20 });
}

async function deliverInApp(userId: string, notification: any): Promise<void> {
  broadcastToUser(userId, {
    event: "notification",
    data: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
    },
    timestamp: new Date().toISOString(),
  });
}

async function deliverPush(userId: string, notification: any, pushToken?: string): Promise<void> {
  if (!pushToken) {
    const device = await basePrisma.userDevice.findFirst({
      where: { userId, isActive: true, pushToken: { not: null } },
      select: { pushToken: true, platform: true },
    });
    if (!device?.pushToken) return;
    pushToken = device.pushToken;
  }

  // FCM push (placeholder — integrate actual FCM SDK)
  logger.info("Push notification queued", { userId, pushToken: pushToken?.slice(0, 10) + "..." });
}
