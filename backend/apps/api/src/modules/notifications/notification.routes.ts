import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";
import { notificationQueue } from "@360crd/queue";

const BroadcastDto = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: z.string().default("announcement"),
  channel: z.enum(["in-app", "email", "both"]).default("in-app"),
  userIds: z.array(z.string()).optional(),
});

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Get my notifications ───────────────────────────────────────────────────
  fastify.get("/", async (req, reply) => {
    const r = req as any;
    const { page = 1, limit = 20, unreadOnly } = req.query as any;
    const where: any = { userId: r.userId, ...(unreadOnly === "true" && { readAt: null }) };
    const [total, data, unreadCount] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where, skip: (Number(page) - 1) * Number(limit), take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where: { userId: r.userId, readAt: null } }),
    ]);
    return reply.send({ success: true, data, meta: { total, unreadCount, page: Number(page), limit: Number(limit) } });
  });

  // ── Get single notification ────────────────────────────────────────────────
  fastify.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const notification = await prisma.notification.findFirst({ where: { id, userId: r.userId } });
    if (!notification) throw new NotFoundError("Notification", id);
    return reply.send({ success: true, data: notification });
  });

  // ── Mark notification as read ──────────────────────────────────────────────
  fastify.patch("/:id/read", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    await prisma.notification.updateMany({
      where: { id, userId: r.userId },
      data: { readAt: new Date(), status: "READ" },
    });
    return reply.send({ success: true });
  });

  // ── Mark all as read ───────────────────────────────────────────────────────
  fastify.patch("/read-all", async (req, reply) => {
    const r = req as any;
    const { count } = await prisma.notification.updateMany({
      where: { userId: r.userId, readAt: null },
      data: { readAt: new Date(), status: "READ" },
    });
    return reply.send({ success: true, data: { marked: count } });
  });

  // ── Delete notification ────────────────────────────────────────────────────
  fastify.delete("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.notification.findFirst({ where: { id, userId: r.userId } });
    if (!existing) throw new NotFoundError("Notification", id);
    await prisma.notification.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Admin: broadcast notification ──────────────────────────────────────────
  fastify.post("/broadcast", { preHandler: [authorize("notification:create")] }, async (req, reply) => {
    const r = req as any;
    const body = BroadcastDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    let targetUserIds: string[] = body.data.userIds ?? [];

    // If no specific users, broadcast to all active tenant users
    if (targetUserIds.length === 0) {
      const users = await basePrisma.user.findMany({
        where: { tenantId: r.tenantId, status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });
      targetUserIds = users.map((u: any) => u.id);
    }

    // Queue notifications (don't block response)
    const jobs = targetUserIds.map(userId =>
      notificationQueue.add("broadcast", {
        tenantId: r.tenantId,
        userId,
        type: body.data.type,
        title: body.data.title,
        message: body.data.message,
        channel: body.data.channel === "both" ? "in-app" : body.data.channel,
      })
    );

    await Promise.all(jobs);

    return reply.send({ success: true, data: { queued: targetUserIds.length } });
  });

  // ── Preferences (placeholder) ──────────────────────────────────────────────
  fastify.get("/preferences", async (req, reply) => {
    const r = req as any;
    const user = await basePrisma.user.findUnique({
      where: { id: r.userId },
      select: { metadata: true },
    });
    const prefs = (user?.metadata as any)?.notificationPrefs ?? {
      email: true,
      inApp: true,
      incidentAssigned: true,
      auditAssigned: true,
      trainingReminder: true,
    };
    return reply.send({ success: true, data: prefs });
  });

  fastify.put("/preferences", async (req, reply) => {
    const r = req as any;
    const prefs = req.body as any;
    const user = await basePrisma.user.findUnique({ where: { id: r.userId }, select: { metadata: true } });
    const currentMeta = (user?.metadata as any) ?? {};
    await basePrisma.user.update({
      where: { id: r.userId },
      data: { metadata: { ...currentMeta, notificationPrefs: prefs } },
    });
    return reply.send({ success: true, data: prefs });
  });
}
