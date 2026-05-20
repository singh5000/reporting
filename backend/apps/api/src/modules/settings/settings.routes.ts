import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";
import nodemailer from "nodemailer";

const auditLog = new AuditLogService();

// ── Validation schemas ─────────────────────────────────────────────────────────

const UpdateBrandingDto = z.object({
  appName: z.string().max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
  loginBgUrl: z.string().url().optional().nullable(),
  supportEmail: z.string().email().optional().nullable(),
  supportPhone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable(),
  footerText: z.string().max(500).optional().nullable(),
  customCss: z.string().optional().nullable(),
  emailHeader: z.string().optional().nullable(),
  emailFooter: z.string().optional().nullable(),
});

const UpdateConfigDto = z.object({
  mfaRequired: z.boolean().optional(),
  sessionTimeoutMins: z.number().min(5).max(10080).optional(),
  maxLoginAttempts: z.number().min(3).max(20).optional(),
  passwordPolicy: z.object({
    minLength: z.number().min(6).max(128).optional(),
    requireUppercase: z.boolean().optional(),
    requireNumber: z.boolean().optional(),
    requireSpecial: z.boolean().optional(),
  }).optional(),
  features: z.record(z.boolean()).optional(),
  incidentCategories: z.array(z.string()).optional(),
  maxFileSizeMb: z.number().min(1).max(500).optional(),
  allowedFileTypes: z.array(z.string()).optional(),
  notifChannels: z.array(z.string()).optional(),
});

const UpsertSmtpDto = z.object({
  host: z.string().min(1),
  port: z.number().min(1).max(65535).default(587),
  secure: z.boolean().default(true),
  username: z.string().min(1),
  password: z.string().min(1),
  fromEmail: z.string().email(),
  fromName: z.string().min(1),
  replyTo: z.string().email().optional(),
});

const CreateApiKeyDto = z.object({
  name: z.string().min(1).max(100).trim(),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional(),
});

const UpsertNotifTemplateDto = z.object({
  event: z.string().min(1),
  channel: z.enum(["email", "in-app", "push"]),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export default async function settingsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ══════════════════════════════════════════════════════════════════════════
  // BRANDING
  // ══════════════════════════════════════════════════════════════════════════

  fastify.get("/branding", { preHandler: [authorize("tenant:read")] }, async (req, reply) => {
    const r = req as any;
    const branding = await basePrisma.tenantBranding.findUnique({ where: { tenantId: r.tenantId } });
    return reply.send({ success: true, data: branding });
  });

  fastify.put("/branding", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    const body = UpdateBrandingDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const before = await basePrisma.tenantBranding.findUnique({ where: { tenantId: r.tenantId } });

    const branding = await basePrisma.tenantBranding.upsert({
      where: { tenantId: r.tenantId },
      update: body.data,
      create: { tenantId: r.tenantId, ...body.data },
    });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "UPDATE",
      resource: "tenant_branding", resourceId: r.tenantId,
      before: before ?? {}, after: body.data,
    });

    return reply.send({ success: true, data: branding });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // TENANT CONFIG
  // ══════════════════════════════════════════════════════════════════════════

  fastify.get("/config", { preHandler: [authorize("tenant:read")] }, async (req, reply) => {
    const r = req as any;
    const config = await basePrisma.tenantConfig.findUnique({ where: { tenantId: r.tenantId } });
    return reply.send({ success: true, data: config });
  });

  fastify.put("/config", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    const body = UpdateConfigDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const existing = await basePrisma.tenantConfig.findUnique({ where: { tenantId: r.tenantId } });

    const config = await basePrisma.tenantConfig.upsert({
      where: { tenantId: r.tenantId },
      update: {
        ...body.data,
        passwordPolicy: body.data.passwordPolicy
          ? { ...(existing?.passwordPolicy as any ?? {}), ...body.data.passwordPolicy }
          : undefined,
        features: body.data.features
          ? { ...(existing?.features as any ?? {}), ...body.data.features }
          : undefined,
      } as any,
      create: { tenantId: r.tenantId, ...(body.data as any) },
    });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "UPDATE",
      resource: "tenant_config", resourceId: r.tenantId, after: body.data,
    });

    return reply.send({ success: true, data: config });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SMTP
  // ══════════════════════════════════════════════════════════════════════════

  fastify.get("/smtp", { preHandler: [authorize("tenant:read")] }, async (req, reply) => {
    const r = req as any;
    const smtp = await basePrisma.tenantSmtp.findUnique({
      where: { tenantId: r.tenantId },
      select: {
        id: true, host: true, port: true, secure: true,
        username: true, fromEmail: true, fromName: true,
        replyTo: true, isVerified: true, verifiedAt: true,
        // Never expose password
      },
    });
    return reply.send({ success: true, data: smtp });
  });

  fastify.put("/smtp", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    const body = UpsertSmtpDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const smtp = await basePrisma.tenantSmtp.upsert({
      where: { tenantId: r.tenantId },
      update: { ...body.data, isVerified: false },
      create: { tenantId: r.tenantId, ...body.data },
      select: {
        id: true, host: true, port: true, secure: true,
        username: true, fromEmail: true, fromName: true,
        replyTo: true, isVerified: true,
      },
    });

    return reply.send({ success: true, data: smtp });
  });

  // Test SMTP connection
  fastify.post("/smtp/test", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    const { testEmail } = req.body as { testEmail: string };
    if (!testEmail) throw new ValidationError("testEmail is required", []);

    const smtp = await basePrisma.tenantSmtp.findUnique({ where: { tenantId: r.tenantId } });
    if (!smtp) throw new NotFoundError("SMTP Config", r.tenantId);

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.username, pass: smtp.password },
      });

      await transporter.verify();
      await transporter.sendMail({
        from: `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to: testEmail,
        subject: "360CRD - SMTP Test Email",
        html: "<h2>SMTP Configuration Test</h2><p>Your SMTP settings are working correctly.</p>",
      });

      // Mark as verified
      await basePrisma.tenantSmtp.update({
        where: { tenantId: r.tenantId },
        data: { isVerified: true, verifiedAt: new Date() },
      });

      return reply.send({ success: true, message: `Test email sent to ${testEmail}` });
    } catch (err: any) {
      return reply.status(400).send({ success: false, error: { code: "SMTP_ERROR", message: err.message } });
    }
  });

  fastify.delete("/smtp", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    await basePrisma.tenantSmtp.deleteMany({ where: { tenantId: r.tenantId } });
    return reply.status(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // API KEYS
  // ══════════════════════════════════════════════════════════════════════════

  fastify.get("/api-keys", { preHandler: [authorize("api_key:read")] }, async (req, reply) => {
    const r = req as any;
    const keys = await prisma.apiKey.findMany({
      where: { tenantId: r.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, permissions: true, isActive: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
        // Never expose keyHash
      },
    });
    return reply.send({ success: true, data: keys });
  });

  fastify.post("/api-keys", { preHandler: [authorize("api_key:create")] }, async (req, reply) => {
    const r = req as any;
    const body = CreateApiKeyDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    // Generate a secure random key: prefix_base64
    const rawKey = `360crd_${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId: r.tenantId,
        userId: r.userId,
        name: body.data.name,
        keyHash,
        permissions: body.data.permissions,
        expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
        isActive: true,
      },
      select: {
        id: true, name: true, permissions: true, isActive: true, expiresAt: true, createdAt: true,
      },
    });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "CREATE",
      resource: "api_key", resourceId: apiKey.id, after: { name: body.data.name },
    });

    // Return raw key ONCE — never stored again
    return reply.status(201).send({ success: true, data: { ...apiKey, key: rawKey } });
  });

  fastify.patch("/api-keys/:id", { preHandler: [authorize("api_key:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const { name, permissions, isActive, expiresAt } = req.body as any;

    const existing = await prisma.apiKey.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("API Key", id);

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(permissions !== undefined && { permissions }),
        ...(isActive !== undefined && { isActive }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
      select: {
        id: true, name: true, permissions: true, isActive: true, expiresAt: true,
      },
    });

    return reply.send({ success: true, data: updated });
  });

  // Revoke (disable) key
  fastify.put("/api-keys/:id/revoke", { preHandler: [authorize("api_key:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.apiKey.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("API Key", id);
    await prisma.apiKey.update({ where: { id }, data: { isActive: false } });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "DELETE",
      resource: "api_key", resourceId: id, before: { name: existing.name },
    });

    return reply.send({ success: true });
  });

  fastify.delete("/api-keys/:id", { preHandler: [authorize("api_key:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await prisma.apiKey.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("API Key", id);
    await prisma.apiKey.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // NOTIFICATION TEMPLATES
  // ══════════════════════════════════════════════════════════════════════════

  fastify.get("/notification-templates", { preHandler: [authorize("tenant:read")] }, async (req, reply) => {
    const r = req as any;
    const templates = await basePrisma.notificationTemplate.findMany({
      where: { OR: [{ tenantId: r.tenantId }, { tenantId: null }] },
      orderBy: [{ tenantId: "asc" }, { event: "asc" }],
    });
    return reply.send({ success: true, data: templates });
  });

  fastify.put("/notification-templates", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const r = req as any;
    const body = UpsertNotifTemplateDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const template = await basePrisma.notificationTemplate.upsert({
      where: { tenantId_event_channel: { tenantId: r.tenantId, event: body.data.event, channel: body.data.channel } },
      update: body.data,
      create: { tenantId: r.tenantId, ...body.data },
    });

    return reply.send({ success: true, data: template });
  });

  fastify.delete("/notification-templates/:id", { preHandler: [authorize("tenant:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    const existing = await basePrisma.notificationTemplate.findFirst({ where: { id, tenantId: r.tenantId } });
    if (!existing) throw new NotFoundError("Notification Template", id);
    await basePrisma.notificationTemplate.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECURITY SETTINGS
  // ══════════════════════════════════════════════════════════════════════════

  // Get active sessions for current user
  fastify.get("/sessions", async (req, reply) => {
    const r = req as any;
    const sessions = await basePrisma.session.findMany({
      where: { userId: r.userId, isActive: true },
      select: {
        id: true, userAgent: true, ipAddress: true, location: true,
        lastActivityAt: true, createdAt: true, expiresAt: true,
      },
      orderBy: { lastActivityAt: "desc" },
    });
    return reply.send({ success: true, data: sessions });
  });

  // Revoke a specific session
  fastify.delete("/sessions/:sessionId", async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const r = req as any;
    await basePrisma.session.updateMany({
      where: { id: sessionId, userId: r.userId },
      data: { isActive: false },
    });
    return reply.status(204).send();
  });

  // Revoke all other sessions (logout everywhere else)
  fastify.delete("/sessions", async (req, reply) => {
    const r = req as any;
    await basePrisma.session.updateMany({
      where: { userId: r.userId, id: { not: r.sessionId }, isActive: true },
      data: { isActive: false },
    });
    return reply.send({ success: true });
  });
}
