import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/http.errors";

export default async function ppeRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("ppe:read")] }, async (req, reply) => {
    const { status, category, page = 1, limit = 20 } = req.query as any;
    const where: any = { ...(status && { status }), ...(category && { category }) };
    const [total, data] = await Promise.all([
      prisma.pPEItem.count({ where }),
      prisma.pPEItem.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        include: { assignments: { where: { returnedAt: null }, include: { user: { select: { id: true, firstName: true, lastName: true } } } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.post("/", { preHandler: [authorize("ppe:create")] }, async (req, reply) => {
    const ppe = await prisma.pPEItem.create({ data: { ...(req.body as any), tenantId: (req as any).tenantId } });
    return reply.status(201).send({ success: true, data: ppe });
  });

  fastify.post("/:id/assign", { preHandler: [authorize("ppe:assign")] }, async (req, reply) => {
    const { id: ppeItemId } = req.params as { id: string };
    const { userId } = req.body as { userId: string };
    const assignment = await prisma.pPEAssignment.create({
      data: { tenantId: (req as any).tenantId, ppeItemId, userId },
    });
    await prisma.pPEItem.update({ where: { id: ppeItemId }, data: { status: "ASSIGNED" } });
    return reply.status(201).send({ success: true, data: assignment });
  });

  fastify.post("/:id/return", { preHandler: [authorize("ppe:assign")] }, async (req, reply) => {
    const { id: ppeItemId } = req.params as { id: string };
    await prisma.pPEAssignment.updateMany({ where: { ppeItemId, returnedAt: null }, data: { returnedAt: new Date() } });
    await prisma.pPEItem.update({ where: { id: ppeItemId }, data: { status: "AVAILABLE" } });
    return reply.send({ success: true });
  });
}
