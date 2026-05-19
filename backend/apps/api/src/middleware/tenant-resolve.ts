import type { FastifyRequest, FastifyReply } from "fastify";
import { basePrisma, tenantContext } from "@360crd/database";
import { tenantCache } from "@360crd/cache";
import type { TenantResolution } from "@360crd/shared-types";
import {
  TenantNotFoundError,
  TenantSuspendedError,
} from "../shared/errors/http.errors";

const TENANT_CACHE_TTL = 300; // 5 minutes

// ─────────────────────────────────────────────────────────────────────────────
// Resolves tenant from request.
// Strategy (in order):
//   1. X-Tenant-ID header      (direct API calls with known tenant ID)
//   2. X-Tenant-Slug header    (white-label by slug)
//   3. Subdomain               (tenant.360crd.com)
//   4. Custom domain           (client.com mapped to tenant)
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveTenant(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const tenantId = request.headers["x-tenant-id"] as string | undefined;
  const tenantSlug = request.headers["x-tenant-slug"] as string | undefined;
  const host = request.hostname;

  let resolution: TenantResolution | null = null;

  if (tenantId) {
    resolution = await getTenantById(tenantId);
  } else if (tenantSlug) {
    resolution = await getTenantBySlug(tenantSlug);
  } else if (host) {
    resolution = await getTenantByHost(host);
  }

  if (!resolution) {
    throw new TenantNotFoundError(tenantId || tenantSlug || host);
  }

  if (resolution.status === "SUSPENDED") {
    throw new TenantSuspendedError();
  }

  if (resolution.status === "CANCELLED") {
    throw new TenantNotFoundError(resolution.slug);
  }

  // Attach to request
  (request as any).tenantId = resolution.id;
  (request as any).tenantSlug = resolution.slug;
  (request as any).tenant = resolution;

  // Set Prisma tenant context (row-based isolation)
  tenantContext.enterWith({
    tenantId: resolution.id,
    userId: (request as any).userId,
    sessionId: (request as any).sessionId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cached tenant lookups
// ─────────────────────────────────────────────────────────────────────────────
async function getTenantById(id: string): Promise<TenantResolution | null> {
  const cacheKey = `id:${id}`;
  return tenantCache.getOrSet(cacheKey, () => fetchTenant({ id }), TENANT_CACHE_TTL);
}

async function getTenantBySlug(slug: string): Promise<TenantResolution | null> {
  const cacheKey = `slug:${slug}`;
  return tenantCache.getOrSet(cacheKey, () => fetchTenant({ slug }), TENANT_CACHE_TTL);
}

async function getTenantByHost(host: string): Promise<TenantResolution | null> {
  // Strip port if present
  const hostname = host.split(":")[0];

  // Check custom domain first
  const domainTenant = await tenantCache.getOrSet(
    `domain:${hostname}`,
    () => fetchTenant({ domain: hostname }),
    TENANT_CACHE_TTL
  );
  if (domainTenant) return domainTenant;

  // Extract subdomain (e.g., "acme" from "acme.360crd.com")
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (!["www", "api", "app"].includes(subdomain)) {
      return tenantCache.getOrSet(
        `subdomain:${subdomain}`,
        () => fetchTenant({ subdomain }),
        TENANT_CACHE_TTL
      );
    }
  }

  return null;
}

async function fetchTenant(
  where: Partial<{ id: string; slug: string; subdomain: string; domain: string }>
): Promise<TenantResolution | null> {
  const tenant = await basePrisma.tenant.findFirst({
    where: { ...where, deletedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      plan: true,
      timezone: true,
      locale: true,
      branding: {
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
        },
      },
      config: {
        select: {
          features: true,
          mfaRequired: true,
          sessionTimeoutMins: true,
          notifChannels: true,
        },
      },
    },
  });

  if (!tenant) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    plan: tenant.plan,
    timezone: tenant.timezone,
    locale: tenant.locale,
    branding: tenant.branding
      ? {
          appName: tenant.branding.appName,
          primaryColor: tenant.branding.primaryColor,
          secondaryColor: tenant.branding.secondaryColor,
          accentColor: tenant.branding.accentColor,
          logoUrl: tenant.branding.logoUrl,
          faviconUrl: tenant.branding.faviconUrl,
          loginBgUrl: tenant.branding.loginBgUrl,
          supportEmail: tenant.branding.supportEmail,
          supportPhone: tenant.branding.supportPhone,
        }
      : undefined,
    config: tenant.config
      ? {
          features: tenant.config.features as Record<string, boolean>,
          mfaRequired: tenant.config.mfaRequired,
          sessionTimeoutMins: tenant.config.sessionTimeoutMins,
          notifChannels: tenant.config.notifChannels,
        }
      : undefined,
  } as TenantResolution;
}

export async function invalidateTenantCache(tenantId: string): Promise<void> {
  const tenant = await basePrisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, slug: true, subdomain: true, domain: true },
  });

  if (tenant) {
    await Promise.all([
      tenantCache.del(`id:${tenant.id}`),
      tenantCache.del(`slug:${tenant.slug}`),
      tenant.subdomain ? tenantCache.del(`subdomain:${tenant.subdomain}`) : Promise.resolve(),
      tenant.domain ? tenantCache.del(`domain:${tenant.domain}`) : Promise.resolve(),
    ]);
  }
}
