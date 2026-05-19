import { Worker, type Job } from "bullmq";
import { redisConnection } from "@360crd/queue";
import { prisma, basePrisma, tenantContext } from "@360crd/database";
import { logger } from "@360crd/logger";
import type { ReportJob } from "@360crd/shared-types";

async function processReport(job: Job<ReportJob>): Promise<void> {
  const { reportId, type, tenantId, parameters } = job.data;

  await basePrisma.report.update({
    where: { id: reportId },
    data: { status: "PROCESSING", startedAt: new Date() },
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
        completedAt: new Date(),
        fileUrl,
        metadata: { rowCount: Array.isArray(data) ? data.length : 1 } as any,
      },
    });

    logger.info("Report generated", { reportId, type, tenantId });
  } catch (err) {
    await basePrisma.report.update({
      where: { id: reportId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        metadata: { error: (err as Error).message } as any,
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
    where.scheduledDate = {};
    if (from) where.scheduledDate.gte = new Date(from as string);
    if (to) where.scheduledDate.lte = new Date(to as string);
  }

  const audits = await prisma.audit.findMany({
    where,
    orderBy: { scheduledDate: "desc" },
    include: { findings: { select: { severity: true, status: true } } },
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
    where: { tenantId, deletedAt: null },
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

export function createReportWorker(): Worker {
  return new Worker<ReportJob>("report", processReport, {
    connection: redisConnection,
    concurrency: 3,
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  });
}
