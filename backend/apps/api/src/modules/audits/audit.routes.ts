import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";

const CreateAuditDto = z.object({
  templateId: z.string().optional(),
  siteId: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  title: z.string().min(3),
  description: z.string().optional(),
  type: z.enum(["SCHEDULED","UNANNOUNCED","FOLLOW_UP","COMPLIANCE","INTERNAL","EXTERNAL"]).default("SCHEDULED"),
  scheduledAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

export default async function auditRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("audit:read")] }, async (req, reply) => {
    const { status, siteId, page = 1, limit = 20 } = req.query as any;
    const where: any = { deletedAt: null, ...(status && { status }), ...(siteId && { siteId }) };
    const [total, data] = await Promise.all([
      prisma.audit.count({ where }),
      prisma.audit.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { createdAt: "desc" },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          site: { select: { id: true, name: true } },
          template: { select: { id: true, name: true } },
        } }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  fastify.post("/", { preHandler: [authorize("audit:create")] }, async (req, reply) => {
    const body = CreateAuditDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const tenantId = (req as any).tenantId;
    const year = new Date().getFullYear();
    const count = await prisma.audit.count({ where: { tenantId, refNumber: { startsWith: `AUD-${year}-` } } });
    const refNumber = `AUD-${year}-${String(count + 1).padStart(4, "0")}`;

    const audit = await prisma.audit.create({
      data: { ...body.data, tenantId, refNumber, status: "DRAFT",
        scheduledAt: body.data.scheduledAt ? new Date(body.data.scheduledAt) : undefined,
        dueDate: body.data.dueDate ? new Date(body.data.dueDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: audit });
  });

  fastify.get("/:id", { preHandler: [authorize("audit:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const audit = await prisma.audit.findFirst({ where: { id, deletedAt: null },
      include: { assignedTo: true, completedBy: true, site: true, template: true, responses: true, auditFindings: true } });
    if (!audit) throw new NotFoundError("Audit", id);
    return reply.send({ success: true, data: audit });
  });

  fastify.patch("/:id", { preHandler: [authorize("audit:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const audit = await prisma.audit.update({ where: { id }, data: req.body as any });
    return reply.send({ success: true, data: audit });
  });

  fastify.get("/templates", { preHandler: [authorize("audit_template:read")] }, async (req, reply) => {
    const templates = await prisma.auditTemplate.findMany({
      where: { OR: [{ tenantId: (req as any).tenantId }, { isPublic: true }], isActive: true },
      include: { _count: { select: { sections: true, audits: true } } },
    });
    return reply.send({ success: true, data: templates });
  });
}
