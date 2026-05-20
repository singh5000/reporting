import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";
import { z } from "zod";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";

const auditLog = new AuditLogService();

const CreateFeedbackDto = z.object({
  type: z.enum(["BUG", "FEATURE_REQUEST", "GENERAL", "COMPLAINT", "COMPLIMENT"]),
  subject: z.string().min(3).max(300).trim(),
  message: z.string().min(10),
  rating: z.number().min(1).max(5).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ListFeedbackDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  type: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

const ResolveFeedbackDto = z.object({
  resolution: z.string().min(1),
  status: z.enum(["RESOLVED", "CLOSED", "WONT_FIX"]).default("RESOLVED"),
});

export default async function feedbackRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Submit feedback (any authenticated user) ───────────────────────────────
  fastify.post("/", async (req, reply) => {
    const r = req as any;
    const body = CreateFeedbackDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const feedback = await prisma.feedback.create({
      data: {
        tenantId: r.tenantId,
        userId: r.userId,
        type: body.data.type,
        subject: body.data.subject,
        message: body.data.message,
        rating: body.data.rating,
        status: "OPEN",
        metadata: body.data.metadata as any,
      },
    });

    return reply.status(201).send({ success: true, data: feedback });
  });

  // ── Get my submitted feedback ──────────────────────────────────────────────
  fastify.get("/my", async (req, reply) => {
    const r = req as any;
    const { page = 1, limit = 20 } = req.query as any;
    const [total, data] = await Promise.all([
      prisma.feedback.count({ where: { tenantId: r.tenantId, userId: r.userId } }),
      prisma.feedback.findMany({
        where: { tenantId: r.tenantId, userId: r.userId },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return reply.send({ success: true, data, meta: { total } });
  });

  // ── Admin: list all feedback ───────────────────────────────────────────────
  fastify.get("/", { preHandler: [authorize("feedback:read")] }, async (req, reply) => {
    const r = req as any;
    const q = ListFeedbackDto.safeParse(req.query);
    if (!q.success) throw new ValidationError("Invalid query", q.error.errors);
    const { page, limit, type, status, search } = q.data;

    const where: any = {
      tenantId: r.tenantId,
      ...(type && { type }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: "insensitive" } },
          { message: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, feedbacks] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Enrich with user data
    const userIds = [...new Set(feedbacks.map((f: any) => f.userId).filter(Boolean))];
    const users = userIds.length > 0
      ? await basePrisma.user.findMany({
          where: { id: { in: userIds as string[] } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));
    const data = feedbacks.map((f: any) => ({ ...f, user: f.userId ? userMap[f.userId] : null }));

    return reply.send({ success: true, data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  });

  // ── Admin: get single feedback ─────────────────────────────────────────────
  fastify.get("/:id", { preHandler: [authorize("feedback:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const feedback = await prisma.feedback.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!feedback) throw new NotFoundError("Feedback", id);

    let user = null;
    if (feedback.userId) {
      user = await basePrisma.user.findUnique({
        where: { id: feedback.userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
    }

    return reply.send({ success: true, data: { ...feedback, user } });
  });

  // ── Admin: update / resolve feedback ──────────────────────────────────────
  fastify.patch("/:id", { preHandler: [authorize("feedback:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const body = ResolveFeedbackDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const existing = await prisma.feedback.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Feedback", id);

    const feedback = await prisma.feedback.update({
      where: { id },
      data: {
        status: body.data.status,
        resolvedAt: new Date(),
        metadata: { ...(existing.metadata as any), resolution: body.data.resolution } as any,
      },
    });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "UPDATE",
      resource: "feedback", resourceId: id,
      before: { status: existing.status }, after: { status: body.data.status },
    });

    return reply.send({ success: true, data: feedback });
  });

  // ── Admin: delete feedback ────────────────────────────────────────────────
  fastify.delete("/:id", { preHandler: [authorize("feedback:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.feedback.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Feedback", id);
    await prisma.feedback.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  fastify.get("/stats", { preHandler: [authorize("feedback:read")] }, async (req, reply) => {
    const r = req as any;
    const [total, byType, byStatus, avgRating] = await Promise.all([
      prisma.feedback.count({ where: { tenantId: r.tenantId } }),
      prisma.feedback.groupBy({ by: ["type"], where: { tenantId: r.tenantId }, _count: true }),
      prisma.feedback.groupBy({ by: ["status"], where: { tenantId: r.tenantId }, _count: true }),
      prisma.feedback.aggregate({ where: { tenantId: r.tenantId, rating: { not: null } }, _avg: { rating: true } }),
    ]);
    return reply.send({
      success: true,
      data: {
        total,
        avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
        byType: byType.reduce((a: any, r) => { a[r.type] = r._count; return a; }, {}),
        byStatus: byStatus.reduce((a: any, r) => { a[r.status] = r._count; return a; }, {}),
      },
    });
  });
}
