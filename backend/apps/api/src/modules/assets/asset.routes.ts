import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";

export default async function assetRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("asset:read")] }, async (req, reply) => {
    const { status, siteId, page = 1, limit = 20 } = req.query as any;
    const where: any = { deletedAt: null, ...(status && { status }), ...(siteId && { siteId }) };
    const [total, data] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        include: { site: { select: { id: true, name: true } }, assignments: { where: { returnedAt: null }, include: { user: { select: { id: true, firstName: true, lastName: true } } } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.post("/", { preHandler: [authorize("asset:create")] }, async (req, reply) => {
    const asset = await prisma.asset.create({ data: { ...(req.body as any), tenantId: (req as any).tenantId } });
    return reply.status(201).send({ success: true, data: asset });
  });

  fastify.patch("/:id", { preHandler: [authorize("asset:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await prisma.asset.update({ where: { id }, data: req.body as any });
    return reply.send({ success: true, data: asset });
  });

  fastify.get("/:id", { preHandler: [authorize("asset:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const asset = await prisma.asset.findFirst({ where: { id, deletedAt: null }, include: { site: true, assignments: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } } });
    return reply.send({ success: true, data: asset });
  });
}
