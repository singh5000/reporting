import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError, NotFoundError, ForbiddenError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";

const auditLog = new AuditLogService();

const CreateInductionDto = z.object({
  siteId: z.string().optional(),
  title: z.string().min(3).max(300).trim(),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  validityDays: z.number().min(1).optional(),
});

const ListInductionsDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  siteId: z.string().optional(),
  search: z.string().optional(),
});

export default async function inductionRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List inductions ─────────────────────────────────────────────────────────
  fastify.get("/", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const r = req as any;
    const q = ListInductionsDto.safeParse(req.query);
    if (!q.success) throw new ValidationError("Invalid query", q.error.errors);
    const { page, limit, status, siteId, search } = q.data;

    const where: any = {
      tenantId: r.tenantId,
      ...(status && { status }),
      ...(siteId && { siteId }),
      ...(search && { title: { contains: search, mode: "insensitive" } }),
    };

    const [total, data] = await Promise.all([
      prisma.induction.count({ where }),
      prisma.induction.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { enrollments: true } },
        },
      }),
    ]);
    return reply.send({ success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  });

  // ── Create induction ────────────────────────────────────────────────────────
  fastify.post("/", { preHandler: [authorize("induction:create")] }, async (req, reply) => {
    const r = req as any;
    const body = CreateInductionDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const induction = await prisma.induction.create({
      data: { ...body.data, tenantId: r.tenantId, status: "DRAFT" as any },
    });

    await auditLog.log({ tenantId: r.tenantId, userId: r.userId, action: "CREATE", resource: "induction", resourceId: induction.id, after: { title: induction.title } });
    return reply.status(201).send({ success: true, data: induction });
  });

  // ── Get induction detail ────────────────────────────────────────────────────
  fastify.get("/:id", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const induction = await prisma.induction.findFirst({
      where: { id, tenantId: r.tenantId },
      include: { _count: { select: { enrollments: true } } },
    });
    if (!induction) throw new NotFoundError("Induction", id);
    return reply.send({ success: true, data: induction });
  });

  // ── Update induction ────────────────────────────────────────────────────────
  fastify.patch("/:id", { preHandler: [authorize("induction:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const body = CreateInductionDto.partial().safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const existing = await prisma.induction.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Induction", id);

    const induction = await prisma.induction.update({ where: { id }, data: body.data });
    return reply.send({ success: true, data: induction });
  });

  // ── Publish / Archive ───────────────────────────────────────────────────────
  fastify.put("/:id/publish", { preHandler: [authorize("induction:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.induction.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Induction", id);
    const induction = await prisma.induction.update({ where: { id }, data: { status: "PUBLISHED" as any } });
    return reply.send({ success: true, data: induction });
  });

  // ── Delete induction ────────────────────────────────────────────────────────
  fastify.delete("/:id", { preHandler: [authorize("induction:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.induction.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Induction", id);
    await prisma.induction.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Enrollments ─────────────────────────────────────────────────────────────
  fastify.get("/:id/enrollments", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const { id: inductionId } = req.params as { id: string };
    const r = req as any;
    const { status } = req.query as any;

    const enrollments = await prisma.inductionEnrollment.findMany({
      where: { inductionId, tenantId: r.tenantId, ...(status && { status }) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: enrollments });
  });

  // Enroll self
  fastify.post("/:id/enroll", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const { id: inductionId } = req.params as { id: string };
    const r = req as any;

    const induction = await prisma.induction.findFirst({ where: { id: inductionId, tenantId: r.tenantId } });
    if (!induction) throw new NotFoundError("Induction", inductionId);
    if (induction.status !== "PUBLISHED") throw new ForbiddenError("Induction is not published");

    const enrollment = await prisma.inductionEnrollment.upsert({
      where: { inductionId_userId: { inductionId, userId: r.userId } },
      update: {},
      create: {
        tenantId: r.tenantId, inductionId, userId: r.userId, status: "ENROLLED",
        expiresAt: induction.validityDays
          ? new Date(Date.now() + induction.validityDays * 24 * 60 * 60 * 1000)
          : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: enrollment });
  });

  // Admin enroll user
  fastify.post("/:id/enroll/:userId", { preHandler: [authorize("induction:assign")] }, async (req, reply) => {
    const { id: inductionId, userId } = req.params as { id: string; userId: string };
    const r = req as any;

    const induction = await prisma.induction.findFirst({ where: { id: inductionId, tenantId: r.tenantId } });
    if (!induction) throw new NotFoundError("Induction", inductionId);

    const enrollment = await prisma.inductionEnrollment.upsert({
      where: { inductionId_userId: { inductionId, userId } },
      update: {},
      create: {
        tenantId: r.tenantId, inductionId, userId, status: "ENROLLED",
        expiresAt: induction.validityDays
          ? new Date(Date.now() + induction.validityDays * 24 * 60 * 60 * 1000)
          : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: enrollment });
  });

  // Complete induction
  fastify.put("/:id/complete", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const { id: inductionId } = req.params as { id: string };
    const r = req as any;

    const enrollment = await prisma.inductionEnrollment.findUnique({
      where: { inductionId_userId: { inductionId, userId: r.userId } },
    });
    if (!enrollment) throw new NotFoundError("Enrollment", inductionId);

    const induction = await prisma.induction.findUnique({ where: { id: inductionId } });
    const updated = await prisma.inductionEnrollment.update({
      where: { inductionId_userId: { inductionId, userId: r.userId } },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        expiresAt: induction?.validityDays
          ? new Date(Date.now() + induction.validityDays * 24 * 60 * 60 * 1000)
          : enrollment.expiresAt,
      },
    });
    return reply.send({ success: true, data: updated });
  });

  // Admin mark complete for a user
  fastify.put("/:id/complete/:userId", { preHandler: [authorize("induction:assign")] }, async (req, reply) => {
    const { id: inductionId, userId } = req.params as { id: string; userId: string };

    const enrollment = await basePrisma.inductionEnrollment.findUnique({
      where: { inductionId_userId: { inductionId, userId } },
    });
    if (!enrollment) throw new NotFoundError("Enrollment", `${inductionId}/${userId}`);

    const induction = await basePrisma.induction.findUnique({ where: { id: inductionId } });
    const updated = await basePrisma.inductionEnrollment.update({
      where: { inductionId_userId: { inductionId, userId } },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        expiresAt: induction?.validityDays
          ? new Date(Date.now() + induction.validityDays * 24 * 60 * 60 * 1000)
          : enrollment.expiresAt,
      },
    });
    return reply.send({ success: true, data: updated });
  });

  // ── My inductions ───────────────────────────────────────────────────────────
  fastify.get("/my-inductions", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const r = req as any;
    const enrollments = await prisma.inductionEnrollment.findMany({
      where: { userId: r.userId, tenantId: r.tenantId },
      include: { induction: { select: { id: true, title: true, description: true, isRequired: true, validityDays: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: enrollments });
  });

  // ── Site inductions ─────────────────────────────────────────────────────────
  fastify.get("/site/:siteId", { preHandler: [authorize("induction:read")] }, async (req, reply) => {
    const { siteId } = req.params as { siteId: string };
    const r = req as any;
    const inductions = await prisma.induction.findMany({
      where: { tenantId: r.tenantId, siteId },
      include: { _count: { select: { enrollments: true } } },
    });
    return reply.send({ success: true, data: inductions });
  });
}
