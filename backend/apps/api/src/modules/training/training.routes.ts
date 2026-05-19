import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError } from "../../shared/errors/http.errors";

export default async function trainingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("training:read")] }, async (req, reply) => {
    const { status, page = 1, limit = 20 } = req.query as any;
    const where: any = { deletedAt: null, ...(status && { status }) };
    const [total, data] = await Promise.all([
      prisma.training.count({ where }),
      prisma.training.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        include: { _count: { select: { enrollments: true, contents: true } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.get("/:id", { preHandler: [authorize("training:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const training = await prisma.training.findFirst({ where: { id, deletedAt: null },
      include: { contents: { orderBy: { order: "asc" } }, questions: { orderBy: { order: "asc" } } } });
    return reply.send({ success: true, data: training });
  });

  fastify.post("/:id/enroll", { preHandler: [authorize("training:read")] }, async (req, reply) => {
    const { id: trainingId } = req.params as { id: string };
    const userId = (req as any).userId;
    const tenantId = (req as any).tenantId;
    const enrollment = await prisma.trainingEnrollment.upsert({
      where: { trainingId_userId: { trainingId, userId } },
      update: {},
      create: { tenantId, trainingId, userId, status: "ENROLLED" },
    });
    return reply.status(201).send({ success: true, data: enrollment });
  });

  fastify.get("/my-enrollments", { preHandler: [authorize("training:read")] }, async (req, reply) => {
    const userId = (req as any).userId;
    const enrollments = await prisma.trainingEnrollment.findMany({
      where: { userId },
      include: { training: { select: { id: true, title: true, type: true, durationMins: true, coverImageUrl: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    return reply.send({ success: true, data: enrollments });
  });
}
