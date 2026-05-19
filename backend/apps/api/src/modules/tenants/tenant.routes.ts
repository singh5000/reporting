import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { requireSuperAdmin, requireTenantAdmin } from "../../middleware/authorize";
import { basePrisma } from "@360crd/database";
import { ValidationError, NotFoundError, ConflictError } from "../../shared/errors/http.errors";
import { invalidateTenantCache } from "../../middleware/tenant-resolve";
import { AuditLogService } from "../audit-logs/audit-log.service";

const auditLog = new AuditLogService();

const CreateTenantDto = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(200),
  legalName: z.string().optional(),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE", "WHITE_LABEL"]).default("STARTER"),
  industry: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().default("UTC"),
  locale: z.string().default("en"),
  maxUsers: z.number().default(50),
  maxSites: z.number().default(10),
});

const UpdateBrandingDto = z.object({
  appName: z.string().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().optional(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  loginBgUrl: z.string().url().optional(),
  supportEmail: z.string().email().optional(),
  supportPhone: z.string().optional(),
  website: z.string().url().optional(),
  footerText: z.string().optional(),
  customCss: z.string().optional(),
});

const UpdateSmtpDto = z.object({
  host: z.string().min(1),
  port: z.number().default(587),
  secure: z.boolean().default(true),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
  replyTo: z.string().email().optional(),
});

export default async function tenantRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── Super admin: list/create tenants ────────────────────────────────────
  fastify.get("/", { preHandler: [requireSuperAdmin()] }, async (req, reply) => {
    const { page = 1, limit = 20, search } = req.query as any;
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null, ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ],
    })};

    const [total, data] = await Promise.all([
      basePrisma.tenant.count({ where }),
      basePrisma.tenant.findMany({ where, skip, take: Number(limit), orderBy: { createdAt: "desc" },
        include: { branding: true, _count: { select: { users: true, sites: true } } } }),
    ]);

    return reply.send({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  fastify.post("/", { preHandler: [requireSuperAdmin()] }, async (req, reply) => {
    const body = CreateTenantDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const existing = await basePrisma.tenant.findUnique({ where: { slug: body.data.slug } });
    if (existing) throw new ConflictError(`Tenant slug '${body.data.slug}' already exists`);

    const tenant = await basePrisma.tenant.create({
      data: { ...body.data, status: "TRIAL" },
    });

    await auditLog.log({
      userId: (req as any).userId, action: "CREATE", resource: "tenant",
      resourceId: tenant.id, after: { slug: tenant.slug, plan: tenant.plan }, ipAddress: req.ip,
    });

    return reply.status(201).send({ success: true, data: tenant });
  });

  // ── Tenant self-management ────────────────────────────────────────────────
  fastify.get("/me", async (req, reply) => {
    const tenant = await basePrisma.tenant.findUnique({
      where: { id: (req as any).tenantId },
      include: { branding: true, config: true },
    });
    return reply.send({ success: true, data: tenant });
  });

  // ── Branding ──────────────────────────────────────────────────────────────
  fastify.put("/me/branding", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const body = UpdateBrandingDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const tenantId = (req as any).tenantId;
    const branding = await basePrisma.tenantBranding.upsert({
      where: { tenantId },
      update: body.data,
      create: { tenantId, ...body.data },
    });

    await invalidateTenantCache(tenantId);
    return reply.send({ success: true, data: branding });
  });

  // ── SMTP ──────────────────────────────────────────────────────────────────
  fastify.put("/me/smtp", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const body = UpdateSmtpDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const tenantId = (req as any).tenantId;
    const smtp = await basePrisma.tenantSmtp.upsert({
      where: { tenantId },
      update: { ...body.data, isVerified: false },
      create: { tenantId, ...body.data },
    });

    return reply.send({ success: true, data: { ...smtp, password: "***" } });
  });

  fastify.post("/me/smtp/test", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const tenantId = (req as any).tenantId;
    const smtp = await basePrisma.tenantSmtp.findUnique({ where: { tenantId } });
    if (!smtp) throw new NotFoundError("SMTP configuration");

    const { emailQueue } = await import("@360crd/queue");
    await emailQueue.add("smtp-test", {
      to: (req as any).userEmail || "test@example.com",
      subject: "360CRD SMTP Test",
      htmlBody: "<p>SMTP configuration is working correctly!</p>",
      tenantId,
    });

    await basePrisma.tenantSmtp.update({ where: { tenantId }, data: { isVerified: true, verifiedAt: new Date() } });
    return reply.send({ success: true, message: "Test email queued" });
  });

  // ── Audit log integrity check ─────────────────────────────────────────────
  fastify.get("/me/audit-integrity", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { AuditLogService } = await import("../audit-logs/audit-log.service");
    const svc = new AuditLogService();
    const result = await svc.verifyIntegrity((req as any).tenantId);
    return reply.send({ success: true, data: result });
  });
}
