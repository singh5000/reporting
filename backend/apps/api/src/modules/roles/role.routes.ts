import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireTenantAdmin } from "../../middleware/authorize";
import { prisma, basePrisma } from "@360crd/database";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";

const CreateRoleDto = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/),
  description: z.string().optional(),
  level: z.number().default(0),
  permissions: z.array(z.string()).default([]),
});

export default async function roleRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("role:read")] }, async (req, reply) => {
    const roles = await prisma.role.findMany({
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { level: "desc" },
    });
    return reply.send({ success: true, data: roles });
  });

  fastify.post("/", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const body = CreateRoleDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const tenantId = (req as any).tenantId;
    const role = await basePrisma.role.create({
      data: { tenantId, name: body.data.name, slug: body.data.slug, description: body.data.description, level: body.data.level },
    });

    if (body.data.permissions.length > 0) {
      const perms = await basePrisma.permission.findMany({ where: { id: { in: body.data.permissions } } });
      await basePrisma.rolePermission.createMany({
        data: perms.map(p => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }

    return reply.status(201).send({ success: true, data: role });
  });

  fastify.get("/permissions", { preHandler: [authorize("role:read")] }, async (_req, reply) => {
    const permissions = await basePrisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
    return reply.send({ success: true, data: permissions });
  });

  fastify.patch("/:id", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = CreateRoleDto.partial().safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const role = await basePrisma.role.update({ where: { id }, data: body.data });
    return reply.send({ success: true, data: role });
  });

  fastify.delete("/:id", { preHandler: [requireTenantAdmin()] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const role = await basePrisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundError("Role", id);
    if (role.isSystem) throw new ValidationError("Cannot delete system roles", []);
    await basePrisma.role.delete({ where: { id } });
    return reply.status(204).send();
  });
}
