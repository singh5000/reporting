import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";

export default async function wasteRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("waste:read")] }, async (req, reply) => {
    const { page = 1, limit = 20 } = req.query as any;
    const [total, data] = await Promise.all([
      prisma.wasteRecord.count(),
      prisma.wasteRecord.findMany({ skip: (page-1)*limit, take: Number(limit), orderBy: { disposedAt: "desc" },
        include: { site: { select: { id: true, name: true } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.post("/", { preHandler: [authorize("waste:create")] }, async (req, reply) => {
    const body = req.body as any;
    const record = await prisma.wasteRecord.create({
      data: { ...body, tenantId: (req as any).tenantId, disposedAt: new Date(body.disposedAt), createdById: (req as any).userId },
    });
    return reply.status(201).send({ success: true, data: record });
  });
}
