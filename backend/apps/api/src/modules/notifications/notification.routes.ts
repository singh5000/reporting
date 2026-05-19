import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { prisma } from "@360crd/database";

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", async (req, reply) => {
    const userId = (req as any).userId;
    const { page = 1, limit = 20, unreadOnly } = req.query as any;
    const where: any = { userId, ...(unreadOnly === "true" && { readAt: null }) };
    const [total, data] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" } }),
    ]);
    const unreadCount = await prisma.notification.count({ where: { userId, readAt: null } });
    return reply.send({ success: true, data, meta: { total, unreadCount } });
  });

  fastify.patch("/:id/read", async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = (req as any).userId;
    await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date(), status: "READ" } });
    return reply.send({ success: true });
  });

  fastify.patch("/read-all", async (req, reply) => {
    const userId = (req as any).userId;
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date(), status: "READ" } });
    return reply.send({ success: true });
  });
}
