import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";

export default async function activityRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("activity_log:read")] }, async (req, reply) => {
    const { page = 1, limit = 50, userId: filterUserId, resource } = req.query as any;
    const tenantId = (req as any).tenantId;
    const where: any = { tenantId, ...(filterUserId && { userId: filterUserId }), ...(resource && { resource }) };
    const [total, data] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.get("/audit-logs", { preHandler: [authorize("audit_log:read")] }, async (req, reply) => {
    const { page = 1, limit = 50, userId: filterUserId, resource, action } = req.query as any;
    const tenantId = (req as any).tenantId;
    const where: any = { tenantId, ...(filterUserId && { userId: filterUserId }), ...(resource && { resource }), ...(action && { action }) };
    const [total, data] = await Promise.all([
      basePrisma.auditLog.count({ where }),
      basePrisma.auditLog.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        select: { id: true, userId: true, action: true, resource: true, resourceId: true, status: true, ipAddress: true, createdAt: true, hash: true } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });
}
