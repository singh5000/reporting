import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/authorize";
import { prisma, basePrisma, tenantContext } from "@360crd/database";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";

const MANAGE_ROLES = ["manager", "tenant_admin"];

const FieldTypeEnum = z.enum([
  "TEXT", "TEXTAREA", "NUMBER", "SELECT", "MULTISELECT",
  "CHECKBOX", "DATE", "URL", "EMAIL", "PHONE",
]);

const FieldOption = z.object({ label: z.string(), value: z.string() });

const CreateFieldDto = z.object({
  module:      z.enum(["incident", "audit"]),
  label:       z.string().min(1).max(100),
  name:        z.string().min(1).max(80).regex(/^[a-z0-9_]+$/, "name must be snake_case"),
  type:        FieldTypeEnum,
  placeholder: z.string().max(200).optional(),
  helpText:    z.string().max(500).optional(),
  isRequired:  z.boolean().default(false),
  isEnabled:   z.boolean().default(true),
  options:     z.array(FieldOption).optional(),
  validation:  z.record(z.unknown()).optional(),
});

const UpdateFieldDto = CreateFieldDto.omit({ module: true, name: true }).partial();

const ReorderDto = z.object({
  ids: z.array(z.string()).min(1),
});

export default async function formFieldRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  // For Super Admin (no tenantId in JWT): resolve tenant from X-Tenant-Slug / X-Tenant-ID header
  fastify.addHook("preHandler", async (req) => {
    const r = req as any;
    if (r.tenantId) return;
    const slug = req.headers["x-tenant-slug"] as string | undefined;
    const tid  = req.headers["x-tenant-id"]   as string | undefined;
    if (!slug && !tid) return;
    const tenant = await basePrisma.tenant.findFirst({
      where: slug ? { slug, deletedAt: null } : { id: tid, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!tenant) return;
    r.tenantId  = tenant.id;
    r.tenantSlug = tenant.slug;
    tenantContext.enterWith({ tenantId: tenant.id, userId: r.userId, sessionId: r.sessionId });
  });

  // ── List fields for a module ──────────────────────────────────────────────
  fastify.get("/", async (req, reply) => {
    const r = req as any;
    if (!r.tenantId) {
      return reply.send({ success: true, data: [] });
    }
    const { module, enabled } = req.query as { module?: string; enabled?: string };

    const where: any = { tenantId: r.tenantId };
    if (module) where.module = module;
    if (enabled === "true") where.isEnabled = true;

    const fields = await prisma.formFieldDefinition.findMany({
      where,
      orderBy: [{ module: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    });

    return reply.send({ success: true, data: fields });
  });

  // ── Create field ──────────────────────────────────────────────────────────
  fastify.post(
    "/",
    { preHandler: [requireRole(...MANAGE_ROLES)] },
    async (req, reply) => {
      const r = req as any;
      if (!r.tenantId) {
        return reply.status(400).send({ success: false, error: { code: "NO_TENANT", message: "Select a company from the header before creating fields" } });
      }
      const parsed = CreateFieldDto.safeParse(req.body);
      if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.errors);

      const { module, label, name, type, placeholder, helpText, isRequired, isEnabled, options, validation } = parsed.data;

      const maxOrder = await prisma.formFieldDefinition.aggregate({
        where: { tenantId: r.tenantId, module },
        _max: { order: true },
      });

      const field = await prisma.formFieldDefinition.create({
        data: {
          tenantId: r.tenantId,
          module,
          name,
          label,
          type: type as any,
          placeholder,
          helpText,
          isRequired,
          isEnabled,
          options: options as any,
          validation: validation as any,
          order: (maxOrder._max.order ?? -1) + 1,
        },
      });

      return reply.status(201).send({ success: true, data: field });
    },
  );

  // ── Update field ──────────────────────────────────────────────────────────
  fastify.patch(
    "/:id",
    { preHandler: [requireRole(...MANAGE_ROLES)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const r = req as any;
      const parsed = UpdateFieldDto.safeParse(req.body);
      if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.errors);

      const existing = await prisma.formFieldDefinition.findFirst({ where: { id, tenantId: r.tenantId } });
      if (!existing) throw new NotFoundError("FormField", id);

      const field = await prisma.formFieldDefinition.update({
        where: { id },
        data: {
          ...parsed.data,
          type: parsed.data.type as any,
          options: parsed.data.options as any,
          validation: parsed.data.validation as any,
        },
      });

      return reply.send({ success: true, data: field });
    },
  );

  // ── Toggle enabled ─────────────────────────────────────────────────────────
  fastify.put(
    "/:id/toggle",
    { preHandler: [requireRole(...MANAGE_ROLES)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const r = req as any;

      const existing = await prisma.formFieldDefinition.findFirst({ where: { id, tenantId: r.tenantId } });
      if (!existing) throw new NotFoundError("FormField", id);

      const field = await prisma.formFieldDefinition.update({
        where: { id },
        data: { isEnabled: !existing.isEnabled },
      });

      return reply.send({ success: true, data: field });
    },
  );

  // ── Reorder fields ─────────────────────────────────────────────────────────
  fastify.put(
    "/reorder",
    { preHandler: [requireRole(...MANAGE_ROLES)] },
    async (req, reply) => {
      const r = req as any;
      const parsed = ReorderDto.safeParse(req.body);
      if (!parsed.success) throw new ValidationError("Validation failed", parsed.error.errors);

      await Promise.all(
        parsed.data.ids.map((id, index) =>
          prisma.formFieldDefinition.updateMany({
            where: { id, tenantId: r.tenantId },
            data: { order: index },
          }),
        ),
      );

      return reply.send({ success: true });
    },
  );

  // ── Delete field ──────────────────────────────────────────────────────────
  fastify.delete(
    "/:id",
    { preHandler: [requireRole(...MANAGE_ROLES)] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const r = req as any;

      const existing = await prisma.formFieldDefinition.findFirst({ where: { id, tenantId: r.tenantId } });
      if (!existing) throw new NotFoundError("FormField", id);

      await prisma.formFieldDefinition.delete({ where: { id } });

      return reply.status(204).send();
    },
  );
}
