import { prisma } from "@360crd/database";
import type { CreateIncidentDtoType, ListIncidentsDtoType } from "./incident.dto";
import type { PaginatedResult } from "@360crd/shared-types";

export class IncidentRepository {
  async create(tenantId: string, reportedById: string, refNumber: string, data: CreateIncidentDtoType) {
    return prisma.incident.create({
      data: {
        tenantId,
        reportedById,
        refNumber,
        title: data.title,
        description: data.description,
        category: data.category,
        subcategory: data.subcategory,
        type: data.type as any,
        severity: data.severity as any,
        priority: data.priority,
        status: "REPORTED",
        occurredAt: new Date(data.occurredAt),
        siteId: data.siteId,
        customerId: data.customerId,
        assignedToId: data.assignedToId,
        location: data.location,
        injuryType: data.injuryType,
        bodyPart: data.bodyPart,
        injuredPersons: data.injuredPersons,
        immediateActions: data.immediateActions,
        isAnonymous: data.isAnonymous,
        isNotifiable: data.isNotifiable,
        latitude: data.latitude as any,
        longitude: data.longitude as any,
        metadata: data.metadata as any,
      },
      include: this.includeRelations(),
    });
  }

  async findById(id: string) {
    return prisma.incident.findFirst({
      where: { id, deletedAt: null },
      include: this.includeRelations(),
    });
  }

  async findMany(
    tenantId: string,
    query: ListIncidentsDtoType
  ): Promise<PaginatedResult<any>> {
    const skip = (query.page - 1) * query.limit;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.severity && { severity: query.severity }),
      ...(query.type && { type: query.type }),
      ...(query.siteId && { siteId: query.siteId }),
      ...(query.customerId && { customerId: query.customerId }),
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
      ...(query.dateFrom || query.dateTo
        ? {
            occurredAt: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
      ...(query.search && {
        OR: [
          { title: { contains: query.search, mode: "insensitive" } },
          { description: { contains: query.search, mode: "insensitive" } },
          { refNumber: { contains: query.search, mode: "insensitive" } },
          { location: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          site: { select: { id: true, name: true, code: true } },
          customer: { select: { id: true, name: true } },
          _count: { select: { capas: true, evidence: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page < Math.ceil(total / query.limit),
        hasPrevPage: query.page > 1,
      },
    };
  }

  async update(id: string, data: Partial<any>) {
    return prisma.incident.update({
      where: { id },
      data,
      include: this.includeRelations(),
    });
  }

  async softDelete(id: string) {
    return prisma.incident.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createCAPA(tenantId: string, incidentId: string, data: any) {
    return prisma.incidentCAPA.create({
      data: { tenantId, incidentId, ...data },
    });
  }

  async updateCAPA(id: string, data: Partial<any>) {
    return prisma.incidentCAPA.update({ where: { id }, data });
  }

  async findCapasByIncident(incidentId: string) {
    return prisma.incidentCAPA.findMany({
      where: { incidentId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getStats(tenantId: string, dateFrom?: Date, dateTo?: Date) {
    const where: any = {
      tenantId,
      deletedAt: null,
      ...(dateFrom || dateTo
        ? { occurredAt: { ...(dateFrom && { gte: dateFrom }), ...(dateTo && { lte: dateTo }) } }
        : {}),
    };

    const [total, bySeverity, byStatus, byType, byMonth] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.groupBy({ by: ["severity"], where, _count: true }),
      prisma.incident.groupBy({ by: ["status"], where, _count: true }),
      prisma.incident.groupBy({ by: ["type"], where, _count: true }),
      prisma.$queryRaw`
        SELECT DATE_TRUNC('month', "occurredAt") as month, COUNT(*) as count
        FROM incidents
        WHERE "tenantId" = ${tenantId} AND "deletedAt" IS NULL
        GROUP BY month ORDER BY month DESC LIMIT 12
      `,
    ]);

    return { total, bySeverity, byStatus, byType, byMonth };
  }

  async generateRefNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await prisma.incident.count({
      where: { tenantId, refNumber: { startsWith: `INC-${year}-` } },
    });
    return `INC-${year}-${String(count + 1).padStart(4, "0")}`;
  }

  private includeRelations() {
    return {
      reportedBy: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      site: { select: { id: true, name: true, code: true, city: true } },
      customer: { select: { id: true, name: true } },
      capas: {
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
      evidence: { orderBy: { uploadedAt: "asc" as const } },
    };
  }
}
