import { Worker, type Job } from "bullmq";
import { redisConnection } from "@360crd/queue";
import { basePrisma } from "@360crd/database";
import { logger } from "@360crd/logger";
import { createHmac } from "crypto";

interface WebhookJob {
  webhookId: string;
  event: string;
  tenantId: string;
  payload: Record<string, unknown>;
  retryCount?: number;
}

async function processWebhook(job: Job<WebhookJob>): Promise<void> {
  const { webhookId, event, tenantId, payload } = job.data;

  const webhook = await basePrisma.webhook.findUnique({
    where: { id: webhookId },
  });

  if (!webhook || !webhook.isActive) {
    logger.warn("Webhook not found or inactive", { webhookId, event });
    return;
  }

  if (!webhook.events.includes(event) && !webhook.events.includes("*")) {
    logger.debug("Webhook not subscribed to event", { webhookId, event });
    return;
  }

  const body = JSON.stringify({
    event,
    tenantId,
    webhookId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = createHmac("sha256", webhook.secret)
    .update(body)
    .digest("hex");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CRD360-Signature": `sha256=${signature}`,
    "X-CRD360-Event": event,
    "X-CRD360-Timestamp": new Date().toISOString(),
    "User-Agent": "360CRD-Webhook/1.0",
    ...(webhook.customHeaders as Record<string, string> | undefined ?? {}),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      await basePrisma.webhook.update({
        where: { id: webhookId },
        data: { lastCalledAt: new Date(), failureCount: 0 },
      });
    } else {
      await basePrisma.webhook.update({
        where: { id: webhookId },
        data: { lastCalledAt: new Date(), failureCount: { increment: 1 } },
      });
    }

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: HTTP ${response.status}`);
    }

    logger.info("Webhook delivered", { webhookId, event, status: response.status });
  } catch (err) {
    clearTimeout(timeout);

    await basePrisma.webhook.update({
      where: { id: webhookId },
      data: {
        lastCalledAt: new Date(),
        failureCount: { increment: 1 },
      },
    });

    // Disable after 10 consecutive failures
    const updated = await basePrisma.webhook.findUnique({
      where: { id: webhookId },
      select: { failureCount: true },
    });

    if (updated && updated.failureCount >= 10) {
      await basePrisma.webhook.update({
        where: { id: webhookId },
        data: { isActive: false },
      });
      logger.warn("Webhook auto-disabled after 10 failures", { webhookId });
    }

    throw err;
  }
}

export function createWebhookWorker(): Worker {
  return new Worker<WebhookJob>("webhook", processWebhook, {
    connection: redisConnection,
    concurrency: 15,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  });
}
