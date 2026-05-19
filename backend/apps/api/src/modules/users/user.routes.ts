import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireTenantAdmin } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { UserRepository } from "./user.repository";
import { ListUsersDto, UpdateUserDto, AssignRoleDto, CreateUserDto } from "./user.dto";
import { ValidationError, NotFoundError, ConflictError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";
import bcrypt from "bcryptjs";
import { config } from "../../config";
import { emailQueue } from "@360crd/queue";
import { invalidatePermissionCache } from "../../middleware/authenticate";

const repo = new UserRepository();
const auditLog = new AuditLogService();

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("user:read")] }, async (req, reply) => {
    const query = ListUsersDto.safeParse(req.query);
    if (!query.success) throw new ValidationError("Invalid query", query.error.errors);
    const result = await repo.findMany((req as any).tenantId, query.data);
    return reply.send({ success: true, ...result });
  });

  fastify.post("/", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const body = CreateUserDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const r = req as any;
    const existing = await repo.findByEmail(r.tenantId, body.data.email);
    if (existing) throw new ConflictError("User with this email already exists");

    const password = body.data.password || Math.random().toString(36).slice(-12) + "A1!";
    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const user = await repo.create(r.tenantId, body.data, passwordHash);

    // Assign roles
    for (const roleId of body.data.roles) {
      await repo.assignRole(user.id, roleId, r.tenantId, r.userId);
    }

    if (body.data.sendWelcomeEmail) {
      await emailQueue.add("welcome", {
        to: user.email,
        subject: "Welcome to 360CRD",
        htmlBody: `<p>Your account has been created. Temporary password: <strong>${password}</strong></p>`,
        tenantId: r.tenantId,
      });
    }

    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "CREATE",
      resource: "user", resourceId: user.id, after: { email: user.email, type: user.type },
      ipAddress: req.ip,
    });

    return reply.status(201).send({ success: true, data: user });
  });

  fastify.get("/:id", { preHandler: [authorize("user:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await repo.findById(id);
    if (!user) throw new NotFoundError("User", id);
    return reply.send({ success: true, data: user });
  });

  fastify.patch("/:id", { preHandler: [authorize("user:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = UpdateUserDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const user = await repo.update(id, body.data);
    const r = req as any;
    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "UPDATE",
      resource: "user", resourceId: id, after: body.data, ipAddress: req.ip,
    });
    return reply.send({ success: true, data: user });
  });

  fastify.delete("/:id", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = req as any;
    if (id === r.userId) throw new ValidationError("Cannot delete your own account", []);
    await repo.softDelete(id);
    await auditLog.log({
      tenantId: r.tenantId, userId: r.userId, action: "DELETE",
      resource: "user", resourceId: id, ipAddress: req.ip,
    });
    return reply.status(204).send();
  });

  // ── Role management ──────────────────────────────────────────────────────
  fastify.post("/:id/roles", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = AssignRoleDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const r = req as any;
    await repo.assignRole(id, body.data.roleId, r.tenantId, r.userId, {
      siteId: body.data.siteId,
      expiresAt: body.data.expiresAt ? new Date(body.data.expiresAt) : undefined,
    });
    await invalidatePermissionCache(id, r.tenantId);
    return reply.status(201).send({ success: true, message: "Role assigned" });
  });

  fastify.delete("/:id/roles/:roleId", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id, roleId } = req.params as { id: string; roleId: string };
    await repo.revokeRole(id, roleId);
    const r = req as any;
    await invalidatePermissionCache(id, r.tenantId);
    return reply.status(204).send();
  });

  fastify.get("/:id/roles", { preHandler: [authorize("user:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const roles = await repo.getUserRoles(id);
    return reply.send({ success: true, data: roles });
  });
}
