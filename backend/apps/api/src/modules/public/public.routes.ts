import type { FastifyInstance } from "fastify";
import { resolveTenant } from "../../middleware/tenant-resolve";
import { basePrisma } from "@360crd/database";
import { NotFoundError } from "../../shared/errors/http.errors";

// Public routes — no authentication required.
// Tenant is resolved via X-Tenant-ID, X-Tenant-Slug, subdomain, or custom domain.
export default async function publicRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", resolveTenant);

  // ── Branding — used by frontend on login page before auth ─────────────────
  fastify.get("/branding", async (req, reply) => {
    const tenantId = (req as any).tenantId as string;

    const branding = await basePrisma.tenantBranding.findUnique({
      where: { tenantId },
      select: {
        appName: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logoUrl: true,
        faviconUrl: true,
        loginBgUrl: true,
        supportEmail: true,
        supportPhone: true,
        website: true,
        footerText: true,
        customCss: true,
      },
    });

    const tenant = await basePrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, locale: true, timezone: true },
    });

    if (!tenant) throw new NotFoundError("Tenant");

    return reply.send({
      success: true,
      data: {
        tenantName: tenant.name,
        locale: tenant.locale,
        timezone: tenant.timezone,
        ...branding,
      },
    });
  });

  // ── Health check (tenant-aware) ───────────────────────────────────────────
  fastify.get("/health", async (req, reply) => {
    const tenant = (req as any).tenant;
    return reply.send({
      success: true,
      data: { tenant: tenant?.slug, status: tenant?.status },
    });
  });
}
