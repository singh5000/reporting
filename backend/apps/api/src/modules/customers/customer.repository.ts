import { prisma, basePrisma } from "@360crd/database";
import type { CreateCustomerDtoType, ListCustomersDtoType, UpdateCustomerDtoType } from "./customer.dto";
import type { PaginatedResult } from "@360crd/shared-types";

const CUSTOMER_SELECT = {
  id: true, tenantId: true, name: true, code: true,
  email: true, phone: true, industry: true, country: true,
  status: true, contractStart: true, contractEnd: true,
  metadata: true, createdAt: true, updatedAt: true,
};

export class CustomerRepository {
  async create(tenantId: string, data: CreateCustomerDtoType) {
    return prisma.customer.create({
      data: {
        tenantId,
        name: data.name,
        code: data.code,
        email: data.email,
        phone: data.phone,
        industry: data.industry,
        country: data.country,
        status: data.status as any,
        contractStart: data.contractStart ? new Date(data.contractStart) : undefined,
        contractEnd: data.contractEnd ? new Date(data.contractEnd) : undefined,
        metadata: data.metadata,
      },
      select: CUSTOMER_SELECT,
    });
  }

  async findMany(tenantId: string, query: ListCustomersDtoType): Promise<PaginatedResult<any>> {
    const skip = (query.page - 1) * query.limit;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.industry && { industry: { contains: query.industry, mode: "insensitive" } }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { code: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where, skip, take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        select: {
          ...CUSTOMER_SELECT,
          _count: { select: { sites: true, incidents: true, audits: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total, page: query.page, limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
        hasNextPage: query.page < Math.ceil(total / query.limit),
        hasPrevPage: query.page > 1,
      },
    };
  }

  async findById(id: string) {
    return prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...CUSTOMER_SELECT,
        sites: {
          where: { deletedAt: null },
          select: { id: true, name: true, code: true, type: true, status: true, city: true, country: true },
        },
        _count: { select: { sites: true, incidents: true, audits: true } },
      },
    });
  }

  async update(id: string, data: UpdateCustomerDtoType) {
    return prisma.customer.update({
      where: { id },
      data: {
        ...data,
        contractStart: data.contractStart ? new Date(data.contractStart) : undefined,
        contractEnd: data.contractEnd ? new Date(data.contractEnd) : undefined,
        status: data.status as any,
      },
      select: CUSTOMER_SELECT,
    });
  }

  async softDelete(id: string) {
    return prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" as any },
    });
  }

  // Assign site to customer
  async assignSite(customerId: string, siteId: string) {
    return basePrisma.site.update({
      where: { id: siteId },
      data: { customerId },
      select: { id: true, name: true, customerId: true },
    });
  }

  // Remove site from customer
  async removeSite(customerId: string, siteId: string) {
    return basePrisma.site.updateMany({
      where: { id: siteId, customerId },
      data: { customerId: null },
    });
  }

  // Get sites belonging to customer
  async getSites(customerId: string) {
    return basePrisma.site.findMany({
      where: { customerId, deletedAt: null },
      select: {
        id: true, name: true, code: true, type: true,
        status: true, city: true, country: true, address: true,
        _count: { select: { incidents: true, audits: true } },
      },
    });
  }

  // Compliance summary for customer
  async getComplianceSummary(tenantId: string, customerId: string) {
    const [incidentStats, auditStats, sites] = await Promise.all([
      basePrisma.incident.groupBy({
        by: ["status"],
        where: { tenantId, customerId, deletedAt: null },
        _count: { id: true },
      }),
      basePrisma.audit.groupBy({
        by: ["status"],
        where: { tenantId, customerId, deletedAt: null },
        _count: { id: true },
      }),
      basePrisma.site.count({ where: { tenantId, customerId, deletedAt: null } }),
    ]);

    const avgAuditScore = await basePrisma.audit.aggregate({
      where: { tenantId, customerId, percentage: { not: null } },
      _avg: { percentage: true },
    });

    return {
      sites,
      incidents: incidentStats.reduce((acc: any, r) => {
        acc[r.status.toLowerCase()] = r._count.id;
        acc.total = (acc.total || 0) + r._count.id;
        return acc;
      }, {}),
      audits: auditStats.reduce((acc: any, r) => {
        acc[r.status.toLowerCase()] = r._count.id;
        acc.total = (acc.total || 0) + r._count.id;
        return acc;
      }, {}),
      complianceScore: Math.round(avgAuditScore._avg.percentage || 0),
    };
  }

  // Sub-users (Customer type users linked to customer via metadata)
  async getSubUsers(tenantId: string, customerId: string) {
    return basePrisma.user.findMany({
      where: {
        tenantId,
        type: "CUSTOMER",
        deletedAt: null,
        metadata: { path: ["customerId"], equals: customerId },
      },
      select: {
        id: true, firstName: true, lastName: true, email: true,
        status: true, jobTitle: true, lastLoginAt: true, createdAt: true,
      },
    });
  }
}
