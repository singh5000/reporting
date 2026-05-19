import { PrismaClient } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

// ─────────────────────────────────────────────────────────────────────────────
// Request context for automatic tenant isolation
// ─────────────────────────────────────────────────────────────────────────────
export interface TenantContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  skipTenantFilter?: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContext>();

// ─────────────────────────────────────────────────────────────────────────────
// Base Prisma Client
// ─────────────────────────────────────────────────────────────────────────────
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const basePrisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
    errorFormat: "minimal",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant-Isolated Prisma Extension
// Automatically injects tenantId into all queries when context is set.
// Super admin bypasses this by setting skipTenantFilter = true.
// ─────────────────────────────────────────────────────────────────────────────
const TENANT_MODELS = new Set([
  "user",
  "role",
  "site",
  "customer",
  "incident",
  "incidentCAPA",
  "incidentEvidence",
  "audit",
  "auditTemplate",
  "auditResponse",
  "auditFinding",
  "training",
  "trainingContent",
  "trainingQuestion",
  "trainingEnrollment",
  "induction",
  "inductionEnrollment",
  "ppeItem",
  "ppeAssignment",
  "asset",
  "assetAssignment",
  "wasteRecord",
  "document",
  "documentVersion",
  "notification",
  "notificationTemplate",
  "report",
  "activityLog",
  "apiKey",
  "webhook",
  "feedback",
]);

export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async findFirst({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async findMany({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async findUnique({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async count({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async update({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async updateMany({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async delete({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        const ctx = tenantContext.getStore();
        if (ctx && !ctx.skipTenantFilter && TENANT_MODELS.has(model)) {
          (args as any).where = {
            ...(args as any).where,
            tenantId: ctx.tenantId,
          };
        }
        return query(args);
      },
    },
  },
});

export type ExtendedPrismaClient = typeof prisma;

export default prisma;
