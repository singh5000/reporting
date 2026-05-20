import { basePrisma } from "@360crd/database";
import { ForbiddenError } from "./errors/http.errors";

// Called before creating a user — throws if tenant has hit maxUsers
export async function assertUserLimit(tenantId: string): Promise<void> {
  const [tenant, count] = await Promise.all([
    basePrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true },
    }),
    basePrisma.user.count({
      where: { tenantId, deletedAt: null },
    }),
  ]);

  if (!tenant) return;
  if (count >= tenant.maxUsers) {
    throw new ForbiddenError(
      `User limit reached (${count}/${tenant.maxUsers}). Upgrade your plan to add more users.`
    );
  }
}

// Called before creating a site — throws if tenant has hit maxSites
export async function assertSiteLimit(tenantId: string): Promise<void> {
  const [tenant, count] = await Promise.all([
    basePrisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxSites: true },
    }),
    basePrisma.site.count({
      where: { tenantId, deletedAt: null },
    }),
  ]);

  if (!tenant) return;
  if (count >= tenant.maxSites) {
    throw new ForbiddenError(
      `Site limit reached (${count}/${tenant.maxSites}). Upgrade your plan to add more sites.`
    );
  }
}
