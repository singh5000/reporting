import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireTenantAdmin } from "../../middleware/authorize";
import { basePrisma } from "@360crd/database";
import { CustomerRepository } from "./customer.repository";
import {
  CreateCustomerDto, UpdateCustomerDto,
  ListCustomersDto, CreateSubUserDto,
} from "./customer.dto";
import { ValidationError, NotFoundError, ConflictError, ForbiddenError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { assertUserLimit } from "../../shared/tenant-limits";
import { emailQueue } from "@360crd/queue";
import { config } from "../../config";
import bcrypt from "bcryptjs";

const repo = new CustomerRepository();
const auditLog = new AuditLogService();

export default async function customerRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // ── List customers ────────────────────────────────────────────────────────
  fastify.get("/", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const query = ListCustomersDto.safeParse(req.query);
    if (!query.success) throw new ValidationError("Invalid query", query.error.errors);
    const result = await repo.findMany((req as any).tenantId, query.data);
    return reply.send({ success: true, ...result });
  });

  // ── Create customer ───────────────────────────────────────────────────────
  fastify.post("/", { preHandler: [authorize("customer:create")] }, async (req, reply) => {
    const body = CreateCustomerDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const r = req as any;
    const customer = await repo.create(r.tenantId, body.data);

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "CREATE",
      resource: "customer", resourceId: customer.id,
      after: { name: customer.name }, ipAddress: req.ip,
    });

    return reply.status(201).send({ success: true, data: customer });
  });

  // ── Get customer detail ───────────────────────────────────────────────────
  fastify.get("/:id", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);
    return reply.send({ success: true, data: customer });
  });

  // ── Update customer ───────────────────────────────────────────────────────
  fastify.patch("/:id", { preHandler: [authorize("customer:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateCustomerDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError("Customer", id);

    const customer = await repo.update(id, body.data);
    const r = req as any;

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "UPDATE",
      resource: "customer", resourceId: id,
      before: { name: existing.name, status: existing.status },
      after: body.data, ipAddress: req.ip,
    });

    return reply.send({ success: true, data: customer });
  });

  // ── Delete customer ───────────────────────────────────────────────────────
  fastify.delete("/:id", { preHandler: [authorize("customer:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await repo.findById(id);
    if (!existing) throw new NotFoundError("Customer", id);

    await repo.softDelete(id);
    const r = req as any;

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "DELETE",
      resource: "customer", resourceId: id,
      before: { name: existing.name }, ipAddress: req.ip,
    });

    return reply.status(204).send();
  });

  // ── Sites ─────────────────────────────────────────────────────────────────
  fastify.get("/:id/sites", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const sites = await repo.getSites(id);
    return reply.send({ success: true, data: sites });
  });

  fastify.post("/:id/sites", { preHandler: [authorize("customer:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { siteId } = req.body as { siteId: string };
    if (!siteId) throw new ValidationError("siteId is required", []);

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const site = await basePrisma.site.findFirst({ where: { id: siteId, tenantId: (req as any).tenantId } });
    if (!site) throw new NotFoundError("Site", siteId);
    if (site.customerId && site.customerId !== id) {
      throw new ForbiddenError("Site is already assigned to another customer");
    }

    await repo.assignSite(id, siteId);
    return reply.status(201).send({ success: true, message: "Site assigned to customer" });
  });

  fastify.delete("/:id/sites/:siteId", { preHandler: [authorize("customer:update")] }, async (req, reply) => {
    const { id, siteId } = req.params as { id: string; siteId: string };
    await repo.removeSite(id, siteId);
    return reply.status(204).send();
  });

  // ── Compliance summary ────────────────────────────────────────────────────
  fastify.get("/:id/compliance", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const summary = await repo.getComplianceSummary(r.tenantId, id);
    return reply.send({ success: true, data: summary });
  });

  // ── Sub-users ─────────────────────────────────────────────────────────────
  fastify.get("/:id/sub-users", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const subUsers = await repo.getSubUsers(r.tenantId, id);
    return reply.send({ success: true, data: subUsers });
  });

  fastify.post("/:id/sub-users", { preHandler: [authorize("customer:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CreateSubUserDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const r = req as any;

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    // Check tenant user limit
    await assertUserLimit(r.tenantId);

    const existing = await basePrisma.user.findUnique({
      where: { tenantId_email: { tenantId: r.tenantId, email: body.data.email } },
    });
    if (existing) throw new ConflictError("User with this email already exists");

    const password = Math.random().toString(36).slice(-10) + "C1!";
    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const user = await basePrisma.user.create({
      data: {
        tenantId: r.tenantId,
        email: body.data.email,
        passwordHash,
        firstName: body.data.firstName,
        lastName: body.data.lastName,
        phone: body.data.phone,
        jobTitle: body.data.jobTitle,
        type: "CUSTOMER",
        mustChangePassword: true,
        emailVerified: false,
        metadata: { customerId: id },
      },
      select: {
        id: true, email: true, firstName: true,
        lastName: true, type: true, status: true, createdAt: true,
      },
    });

    // Assign customer role
    const customerRole = await basePrisma.role.findFirst({ where: { slug: "customer", tenantId: null } });
    if (customerRole) {
      await basePrisma.userRole.create({
        data: { userId: user.id, roleId: customerRole.id, tenantId: r.tenantId, assignedBy: r.userId },
      });
    }

    if (body.data.sendWelcomeEmail) {
      await emailQueue.add("customer-welcome", {
        to: user.email,
        subject: "Your customer portal access",
        htmlBody: `<p>Welcome! Your customer portal account has been created.</p><p>Email: ${user.email}<br>Temporary Password: <strong>${password}</strong></p>`,
        tenantId: r.tenantId,
      });
    }

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "CREATE",
      resource: "user", resourceId: user.id,
      after: { email: user.email, type: "CUSTOMER", customerId: id }, ipAddress: req.ip,
    });

    return reply.status(201).send({ success: true, data: user });
  });

  // ── Portal access toggle ──────────────────────────────────────────────────
  fastify.put("/:id/access", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { enabled } = req.body as { enabled: boolean };
    if (typeof enabled !== "boolean") throw new ValidationError("enabled (boolean) is required", []);

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const r = req as any;

    // Toggle all sub-users' status
    await basePrisma.user.updateMany({
      where: {
        tenantId: r.tenantId,
        type: "CUSTOMER",
        metadata: { path: ["customerId"], equals: id },
      },
      data: { status: enabled ? "ACTIVE" : "SUSPENDED" },
    });

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId,
      action: enabled ? "PORTAL_ENABLED" : "PORTAL_DISABLED",
      resource: "customer", resourceId: id, ipAddress: req.ip,
    });

    return reply.send({
      success: true,
      message: `Customer portal ${enabled ? "enabled" : "disabled"}`,
    });
  });

  // ── Contracts ─────────────────────────────────────────────────────────────
  fastify.get("/:id/contracts", { preHandler: [authorize("customer:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;

    const contracts = await basePrisma.document.findMany({
      where: {
        tenantId: r.tenantId,
        deletedAt: null,
        tags: { has: `customer:${id}` },
        category: "CONTRACT",
      },
      select: {
        id: true, title: true, filename: true, fileUrl: true,
        version: true, status: true, fileSize: true,
        mimeType: true, createdAt: true,
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ success: true, data: contracts });
  });

  fastify.post("/:id/contracts", { preHandler: [authorize("customer:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;

    const body = (req.body as any);
    if (!body?.fileUrl || !body?.filename) {
      throw new ValidationError("fileUrl and filename are required", []);
    }

    const customer = await repo.findById(id);
    if (!customer) throw new NotFoundError("Customer", id);

    const doc = await basePrisma.document.create({
      data: {
        tenantId: r.tenantId,
        uploadedById: r.userId,
        title: body.title || body.filename,
        filename: body.filename,
        fileUrl: body.fileUrl,
        storageKey: body.storageKey,
        fileSize: body.fileSize,
        mimeType: body.mimeType,
        category: "CONTRACT",
        tags: [`customer:${id}`],
        status: "PUBLISHED",
      },
      select: {
        id: true, title: true, filename: true,
        fileUrl: true, status: true, createdAt: true,
      },
    });

    return reply.status(201).send({ success: true, data: doc });
  });
}
