import { prisma, basePrisma } from "@360crd/database";
import type { CreateUserDtoType, ListUsersDtoType } from "./user.dto";
import type { PaginatedResult } from "@360crd/shared-types";

const USER_SELECT = {
  id: true, tenantId: true, email: true, firstName: true, lastName: true,
  avatarUrl: true, type: true, status: true, department: true, jobTitle: true,
  employeeId: true, phone: true, emailVerified: true, mfaEnabled: true,
  lastLoginAt: true, lastLoginIp: true, mustChangePassword: true,
  failedLoginAttempts: true, lockedUntil: true, createdAt: true, updatedAt: true,
};

export class UserRepository {
  async create(tenantId: string, data: CreateUserDtoType, passwordHash: string) {
    return prisma.user.create({
      data: {
        tenantId,
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        department: data.department,
        jobTitle: data.jobTitle,
        employeeId: data.employeeId,
        type: data.type as any,
        mustChangePassword: data.mustChangePassword,
      },
      select: USER_SELECT,
    });
  }

  async findById(id: string, includeSensitive = false) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: includeSensitive
        ? { ...USER_SELECT, passwordHash: true, mfaSecret: true }
        : USER_SELECT,
    });
  }

  async findByEmail(tenantId: string, email: string) {
    return prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      select: USER_SELECT,
    });
  }

  async findMany(tenantId: string, query: ListUsersDtoType): Promise<PaginatedResult<any>> {
    const skip = (query.page - 1) * query.limit;

    const where: any = {
      tenantId,
      deletedAt: null,
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.siteId && { sites: { some: { siteId: query.siteId } } }),
      ...(query.roleSlug && {
        roles: { some: { role: { slug: query.roleSlug } } },
      }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { employeeId: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        select: {
          ...USER_SELECT,
          roles: {
            include: {
              role: { select: { id: true, name: true, slug: true, level: true } },
            },
          },
          sites: {
            include: { site: { select: { id: true, name: true, code: true } } },
          },
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

  async update(id: string, data: Partial<any>) {
    return prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
  }

  async assignRole(userId: string, roleId: string, tenantId: string, assignedBy: string, extra?: any) {
    return prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { ...extra, assignedBy },
      create: { userId, roleId, tenantId, assignedBy, ...extra },
    });
  }

  async revokeRole(userId: string, roleId: string) {
    return prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async getUserRoles(userId: string) {
    return prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });
  }

  async assignSites(userId: string, siteIds: string[]) {
    await basePrisma.userSite.deleteMany({ where: { userId } });
    if (siteIds.length === 0) return;
    await basePrisma.userSite.createMany({
      data: siteIds.map(siteId => ({ userId, siteId })),
      skipDuplicates: true,
    });
  }

  async addSite(userId: string, siteId: string) {
    return basePrisma.userSite.upsert({
      where: { userId_siteId: { userId, siteId } },
      update: {},
      create: { userId, siteId },
    });
  }

  async removeSite(userId: string, siteId: string) {
    return basePrisma.userSite.deleteMany({ where: { userId, siteId } });
  }

  async getUserSites(userId: string) {
    return basePrisma.userSite.findMany({
      where: { userId },
      include: {
        site: {
          select: {
            id: true, name: true, code: true, type: true,
            status: true, city: true, country: true,
          },
        },
      },
    });
  }

  async unlock(userId: string) {
    return basePrisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
      select: USER_SELECT,
    });
  }

  async getLoginActivity(userId: string, limit = 20) {
    return basePrisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, ipAddress: true, userAgent: true,
        location: true, isActive: true, createdAt: true, expiresAt: true,
      },
    });
  }

  async getActivityLogs(tenantId: string, userId: string, limit = 50) {
    return basePrisma.activityLog.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true, action: true, description: true,
        resource: true, resourceId: true, ipAddress: true, createdAt: true,
      },
    });
  }

  async getUsersOnSites(tenantId: string, siteIds: string[], query: ListUsersDtoType): Promise<any> {
    const skip = (query.page - 1) * query.limit;
    const where: any = {
      tenantId,
      deletedAt: null,
      sites: { some: { siteId: { in: siteIds } } },
      ...(query.status && { status: query.status }),
      ...(query.type && { type: query.type }),
      ...(query.search && {
        OR: [
          { firstName: { contains: query.search, mode: "insensitive" } },
          { lastName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where, skip, take: query.limit,
        orderBy: { [query.sortBy]: query.sortOrder },
        select: {
          ...USER_SELECT,
          roles: { include: { role: { select: { id: true, name: true, slug: true } } } },
          sites: { include: { site: { select: { id: true, name: true } } } },
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
}
