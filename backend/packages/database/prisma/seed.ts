import { PrismaClient, UserType, TenantPlan, TenantStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── System Permissions ──────────────────────────────────────────────────────
  const resources = [
    "tenant", "user", "role", "site", "customer",
    "incident", "audit", "audit_template", "training",
    "induction", "ppe", "asset", "waste", "document",
    "notification", "report", "activity_log", "audit_log",
    "api_key", "webhook", "feedback",
  ];
  const actions = ["create", "read", "update", "delete", "approve", "export", "assign"];

  for (const resource of resources) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: { resource_action_scope: { resource, action, scope: "TENANT" } },
        update: {},
        create: { resource, action, scope: "TENANT", description: `${action} ${resource}` },
      });
    }
  }

  console.log("✅ Permissions seeded");

  // ── System Roles (tenantId = null → use findFirst+create, not upsert) ─────────
  async function findOrCreateSystemRole(data: {
    slug: string; name: string; description: string;
    level: number; isDefault?: boolean;
  }) {
    const existing = await prisma.role.findFirst({ where: { slug: data.slug, tenantId: null } });
    if (existing) return existing;
    return prisma.role.create({ data: { ...data, tenantId: null, isSystem: true } });
  }

  const superAdminRole = await findOrCreateSystemRole({
    slug: "super_admin", name: "Super Admin",
    description: "Platform super administrator", level: 100,
  });

  const tenantAdminRole = await findOrCreateSystemRole({
    slug: "tenant_admin", name: "Tenant Admin",
    description: "Tenant administrator with full tenant access", level: 80,
  });

  const managerRole = await findOrCreateSystemRole({
    slug: "manager", name: "Manager",
    description: "Manager with operational access", level: 60,
  });

  const staffRole = await findOrCreateSystemRole({
    slug: "staff", name: "Staff",
    description: "Regular staff member", level: 20, isDefault: true,
  });

  console.log("✅ System roles seeded");

  // ── Assign all permissions to super admin ────────────────────────────────────
  const allPerms = await prisma.permission.findMany();
  for (const perm of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: perm.id },
    });
  }

  // ── Tenant Admin gets all except global tenant management ─────────────────────
  const tenantAdminPerms = allPerms.filter(p => p.resource !== "tenant" || p.action === "read");
  for (const perm of tenantAdminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: tenantAdminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: tenantAdminRole.id, permissionId: perm.id },
    });
  }

  console.log("✅ Role permissions assigned");

  // ── System Tenant ─────────────────────────────────────────────────────────────
  const systemTenant = await prisma.tenant.upsert({
    where: { slug: "system" },
    update: {},
    create: {
      slug: "system",
      name: "360CRD Platform",
      legalName: "360CRD Platform Pty Ltd",
      plan: TenantPlan.WHITE_LABEL,
      status: TenantStatus.ACTIVE,
      country: "AU",
      timezone: "Australia/Sydney",
      maxUsers: 9999,
      maxSites: 9999,
    },
  });

  // ── Super Admin User ──────────────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || "superadmin@360crd.io";
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@360!";
  const passwordHash = await bcrypt.hash(superAdminPassword, 12);

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: systemTenant.id, email: superAdminEmail } },
    update: {},
    create: {
      tenantId: systemTenant.id,
      email: superAdminEmail,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash,
      firstName: process.env.SUPER_ADMIN_FIRST_NAME || "Super",
      lastName: process.env.SUPER_ADMIN_LAST_NAME || "Admin",
      type: UserType.SUPER_ADMIN,
      mustChangePassword: false,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRole.id } },
    update: {},
    create: {
      userId: superAdmin.id,
      roleId: superAdminRole.id,
      tenantId: systemTenant.id,
      assignedBy: superAdmin.id,
    },
  });

  console.log(`✅ Super admin created: ${superAdminEmail}`);

  // ── Demo Tenant ───────────────────────────────────────────────────────────────
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: "demo-corp" },
    update: {},
    create: {
      slug: "demo-corp",
      name: "Demo Corporation",
      legalName: "Demo Corporation Pty Ltd",
      subdomain: "demo",
      plan: TenantPlan.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      industry: "Construction",
      country: "AU",
      timezone: "Australia/Sydney",
      maxUsers: 200,
      maxSites: 50,
    },
  });

  await prisma.tenantBranding.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      appName: "Demo EHS",
      primaryColor: "#1E40AF",
      secondaryColor: "#7C3AED",
    },
  });

  await prisma.tenantConfig.upsert({
    where: { tenantId: demoTenant.id },
    update: {},
    create: {
      tenantId: demoTenant.id,
      features: { incidents: true, audits: true, training: true, ppe: true, assets: true },
    },
  });

  console.log(`✅ Demo tenant created: ${demoTenant.slug}`);

  // ── Demo Admin User ───────────────────────────────────────────────────────────
  const demoAdminEmail = process.env.DEMO_ADMIN_EMAIL || "admin@demo-corp.com";
  const demoAdminPassword = process.env.DEMO_ADMIN_PASSWORD || "Demo@360!";
  const demoAdminHash = await bcrypt.hash(demoAdminPassword, 12);

  const demoAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: demoTenant.id, email: demoAdminEmail } },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: demoAdminEmail,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      passwordHash: demoAdminHash,
      firstName: "Demo",
      lastName: "Admin",
      type: UserType.STAFF,
      mustChangePassword: false,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: demoAdmin.id, roleId: tenantAdminRole.id } },
    update: {},
    create: {
      userId: demoAdmin.id,
      roleId: tenantAdminRole.id,
      tenantId: demoTenant.id,
      assignedBy: demoAdmin.id,
    },
  });

  console.log(`✅ Demo admin created: ${demoAdminEmail}`);
  console.log("🎉 Seed complete!");
}

main()
  .catch(e => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
