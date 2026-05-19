import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { prisma } from "@360crd/database";
import { ValidationError, NotFoundError } from "../../shared/errors/http.errors";

const SiteDto = z.object({
  name: z.string().min(2),
  code: z.string().optional(),
  type: z.enum(["FACILITY","WAREHOUSE","OFFICE","CONSTRUCTION","REMOTE","RETAIL","OTHER"]).default("FACILITY"),
  status: z.enum(["ACTIVE","INACTIVE","UNDER_CONSTRUCTION","CLOSED"]).default("ACTIVE"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  customerId: z.string().optional(),
});

export default async function siteRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/", { preHandler: [authorize("site:read")] }, async (req, reply) => {
    const { search, status, page = 1, limit = 50 } = req.query as any;
    const where: any = { deletedAt: null, ...(status && { status }), ...(search && {
      OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }],
    })};
    const [total, data] = await Promise.all([
      prisma.site.count({ where }),
      prisma.site.findMany({ where, skip: (page-1)*limit, take: Number(limit), orderBy: { name: "asc" },
        include: { customer: { select: { id: true, name: true } }, _count: { select: { incidents: true, audits: true } } } }),
    ]);
    return reply.send({ success: true, data, meta: { total, page: Number(page), limit: Number(limit) } });
  });

  fastify.post("/", { preHandler: [authorize("site:create")] }, async (req, reply) => {
    const body = SiteDto.safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);
    const site = await prisma.site.create({ data: { ...body.data, tenantId: (req as any).tenantId, latitude: body.data.latitude as any, longitude: body.data.longitude as any } });
    return reply.status(201).send({ success: true, data: site });
  });

  fastify.get("/:id", { preHandler: [authorize("site:read")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const site = await prisma.site.findFirst({ where: { id, deletedAt: null }, include: { customer: true, _count: { select: { incidents: true, audits: true, assets: true } } } });
    if (!site) throw new NotFoundError("Site", id);
    return reply.send({ success: true, data: site });
  });

  fastify.patch("/:id", { preHandler: [authorize("site:update")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = SiteDto.partial().safeParse(req.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);
    const site = await prisma.site.update({ where: { id }, data: body.data as any });
    return reply.send({ success: true, data: site });
  });

  fastify.delete("/:id", { preHandler: [authorize("site:delete")] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.site.update({ where: { id }, data: { deletedAt: new Date() } });
    return reply.status(204).send();
  });
}
