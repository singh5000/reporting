import { Worker, type Job } from "bullmq";
import { redisConnection } from "@360crd/queue";
import { prisma, basePrisma, tenantContext } from "@360crd/database";
import { logger } from "@360crd/logger";
import type { ReportJob } from "@360crd/shared-types";

async function processReport(job: Job<ReportJob>): Promise<void> {
  const { reportId, type, tenantId, parameters } = job.data;

  await basePrisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING" },
  });

  try {
    const data = await tenantContext.run({ tenantId, skipTenantFilter: false }, async () => {
      switch (type) {
        case "INCIDENT_SUMMARY":
          return generateIncidentSummary(tenantId, parameters);
        case "AUDIT_SUMMARY":
          return generateAuditSummary(tenantId, parameters);
        case "TRAINING_COMPLETION":
          return generateTrainingCompletion(tenantId, parameters);
        case "PPE_INVENTORY":
          return generatePpeInventory(tenantId, parameters);
        case "WASTE_SUMMARY":
          return generateWasteSummary(tenantId, parameters);
        case "COMPLIANCE_STATUS":
          return generateComplianceStatus(tenantId, parameters);
        case "CUSTOM":
          return { message: "Custom report — no generator registered", parameters };
        default:
          throw new Error(`Unknown report type: ${type}`);
      }
    });

    // In production: upload JSON/PDF to S3 and store fileUrl
    const fileUrl = `reports/${tenantId}/${reportId}.json`;

    await basePrisma.report.update({
      where: { id: reportId },
      data: {
        status: "COMPLETED",
        generatedAt: new Date(),
        fileUrl,
      },
    });

    logger.info("Report generated", { reportId, type, tenantId });
  } catch (err) {
    await basePrisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        generatedAt: new Date(),
        error: (err as Error).message,
      },
    });
    throw err;
  }
}

// ── Report generators ─────────────────────────────────────────────────────────

async function generateIncidentSummary(
  tenantId: string,
  params: Record<string, unknown>
) {
  const { from, to } = params as { from?: string; to?: string };
  const where: any = { tenantId, deletedAt: null };
  if (from || to) {
    where.occurredAt = {};
    if (from) where.occurredAt.gte = new Date(from as string);
    if (to) where.occurredAt.lte = new Date(to as string);
  }

  const [incidents, bySeverity, byStatus] = await Promise.all([
    prisma.incident.findMany({ where, orderBy: { occurredAt: "desc" } }),
    prisma.incident.groupBy({ by: ["severity"], where, _count: true }),
    prisma.incident.groupBy({ by: ["status"], where, _count: true }),
  ]);

  return { incidents, summary: { bySeverity, byStatus, total: incidents.length } };
}

async function generateAuditSummary(
  tenantId: string,
  params: Record<string, unknown>
) {
  const { from, to } = params as { from?: string; to?: string };
  const where: any = { tenantId, deletedAt: null };
  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt.gte = new Date(from as string);
    if (to) where.scheduledAt.lte = new Date(to as string);
  }

  const audits = await prisma.audit.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: { auditFindings: { select: { severity: true, status: true } } },
  });

  return { audits, total: audits.length };
}

async function generateTrainingCompletion(
  tenantId: string,
  params: Record<string, unknown>
) {
  const enrollments = await prisma.trainingEnrollment.findMany({
    where: { tenantId },
    include: {
      training: { select: { title: true } },
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });

  const byStatus = enrollments.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {});

  return { enrollments, summary: { byStatus, total: enrollments.length } };
}

async function generatePpeInventory(
  tenantId: string,
  _params: Record<string, unknown>
) {
  const items = await prisma.pPEItem.findMany({
    where: { tenantId },
    include: {
      assignments: {
        where: { returnedAt: null },
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return { items, total: items.length };
}

async function generateWasteSummary(
  tenantId: string,
  params: Record<string, unknown>
) {
  const { from, to, siteId } = params as { from?: string; to?: string; siteId?: string };
  const where: any = { tenantId, ...(siteId && { siteId }) };
  if (from || to) {
    where.disposedAt = {};
    if (from) where.disposedAt.gte = new Date(from as string);
    if (to) where.disposedAt.lte = new Date(to as string);
  }

  const [records, byCategory, aggregates] = await Promise.all([
    basePrisma.wasteRecord.findMany({ where, orderBy: { disposedAt: "desc" }, include: { site: { select: { name: true } } } }),
    basePrisma.wasteRecord.groupBy({ by: ["category"], where, _count: true, _sum: { quantity: true } }),
    basePrisma.wasteRecord.aggregate({ where, _sum: { quantity: true, cost: true } }),
  ]);

  return {
    records,
    summary: {
      total: records.length,
      totalQuantity: aggregates._sum.quantity,
      totalCost: aggregates._sum.cost,
      byCategory,
    },
  };
}

async function generateComplianceStatus(
  tenantId: string,
  _params: Record<string, unknown>
) {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [auditScore, overdueAudits, openIncidents, trainingRate, inductionRate] = await Promise.all([
    basePrisma.audit.aggregate({
      where: { tenantId, percentage: { not: null } },
      _avg: { percentage: true },
    }),
    basePrisma.audit.count({
      where: { tenantId, deletedAt: null, status: { notIn: ["COMPLETED", "REVIEWED", "ARCHIVED", "CANCELLED"] }, dueDate: { lt: now } },
    }),
    basePrisma.incident.count({
      where: { tenantId, deletedAt: null, status: { notIn: ["CLOSED", "CANCELLED"] } },
    }),
    basePrisma.trainingEnrollment.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    }),
    basePrisma.inductionEnrollment.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    }),
  ]);

  const trainingTotal = trainingRate.reduce((s: number, r: any) => s + r._count, 0);
  const trainingCompleted = trainingRate.find((r: any) => r.status === "COMPLETED")?._count ?? 0;
  const inductionTotal = inductionRate.reduce((s: number, r: any) => s + r._count, 0);
  const inductionCompleted = inductionRate.find((r: any) => r.status === "COMPLETED")?._count ?? 0;

  return {
    complianceScore: Math.round(auditScore._avg.percentage ?? 0),
    overdueAudits,
    openIncidents,
    trainingCompletionRate: trainingTotal > 0 ? Math.round((trainingCompleted / trainingTotal) * 100) : 0,
    inductionCompletionRate: inductionTotal > 0 ? Math.round((inductionCompleted / inductionTotal) * 100) : 0,
    generatedAt: now,
  };
}

export async function generateReportData(type: string, tenantId: string, parameters: Record<string, unknown>) {
  switch (type) {
    case "INCIDENT_SUMMARY":    return generateIncidentSummary(tenantId, parameters);
    case "AUDIT_SUMMARY":       return generateAuditSummary(tenantId, parameters);
    case "TRAINING_COMPLETION": return generateTrainingCompletion(tenantId, parameters);
    case "PPE_INVENTORY":       return generatePpeInventory(tenantId, parameters);
    case "WASTE_SUMMARY":       return generateWasteSummary(tenantId, parameters);
    case "COMPLIANCE_STATUS":   return generateComplianceStatus(tenantId, parameters);
    default: return { message: `No generator for type: ${type}` };
  }
}

export function createReportWorker(): Worker {
  return new Worker<ReportJob>("report", processReport, {
    connection: redisConnection,
    concurrency: 3,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  });
}
