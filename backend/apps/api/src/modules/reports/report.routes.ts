import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { reportQueue } from "@360crd/queue";
import { ValidationError } from "../../shared/errors/http.errors";

const RequestReportDto = z.object({
  title: z.string().min(3),
  type: z.enum(["INCIDENT_SUMMARY","AUDIT_SUMMARY","TRAINING_COMPLETION","PPE_INVENTORY","WASTE_SUMMARY","COMPLIANCE_STATUS","CUSTOM"]),
  parameters: z.record(z.unknown()).default({}),
  filters: z.record(z.unknown()).default({}),
});

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("report:read")] }, async (req, reply) => {
    const reports = await prisma.report.findMany({
      where: { requestedById: (req as any).userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ success: true, data: reports });
  });

  fastify.post("/", { preHandler: [authorize("report:create")] }, async (req, reply) => {
    const body = RequestReportDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const tenantId = (req as any).tenantId;
    const userId = (req as any).userId;

    const report = await prisma.report.create({
      data: { tenantId, title: body.data.title, type: body.data.type as any, status: "PENDING",
        parameters: body.data.parameters as any, filters: body.data.filters as any, requestedById: userId },
    });

    await reportQueue.add("generate", { tenantId, reportId: report.id, type: body.data.type,
      parameters: body.data.parameters, filters: body.data.filters, requestedById: userId });

    return reply.status(201).send({ success: true, data: report });
  });

  fastify.get("/:id", { preHandler: [authorize("report:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = await prisma.report.findUnique({ where: { id } });
    return reply.send({ success: true, data: report });
  });
}
