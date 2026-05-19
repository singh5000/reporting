import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { webhookQueue } from "@360crd/queue";
import { NotFoundError } from "../../shared/errors/http.errors";
import { randomBytes } from "crypto";

export default async function webhookRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("webhook:read")] }, async (req, reply) => {
    const tenantId = (req as any).tenantId;
    const data = await prisma.webhook.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, url: true, events: true, isActive: true,
        failureCount: true, lastCalledAt: true, description: true, createdAt: true,
      },
    });
    return reply.send({ success: true, data });
  });

  fastify.post("/", { preHandler: [authorize("webhook:create")] }, async (req, reply) => {
    const { url, events, description, customHeaders } = req.body as any;
    const tenantId = (req as any).tenantId;
    const secret = randomBytes(32).toString("hex");

    const webhook = await prisma.webhook.create({
      data: { tenantId, url, events, secret, description, customHeaders },
    });

    return reply.status(201).send({
      success: true,
      data: { ...webhook, secret },
    });
  });

  fastify.patch("/:id", { preHandler: [authorize("webhook:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { url, events, isActive, description, customHeaders } = req.body as any;
    const tenantId = (req as any).tenantId;

    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundError("Webhook");

    const updated = await prisma.webhook.update({
      where: { id },
      data: { url, events, isActive, description, customHeaders },
    });
    return reply.send({ success: true, data: updated });
  });

  fastify.delete("/:id", { preHandler: [authorize("webhook:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = (req as any).tenantId;

    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundError("Webhook");

    await prisma.webhook.delete({ where: { id } });
    return reply.send({ success: true });
  });

  fastify.post("/:id/test", { preHandler: [authorize("webhook:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = (req as any).tenantId;

    const webhook = await prisma.webhook.findFirst({ where: { id, tenantId } });
    if (!webhook) throw new NotFoundError("Webhook");

    await webhookQueue.add("webhook.test", {
      webhookId: webhook.id,
      event: "webhook.test",
      tenantId,
      payload: { message: "Test webhook delivery from 360CRD" },
    });

    return reply.send({ success: true, message: "Test event queued" });
  });
}
