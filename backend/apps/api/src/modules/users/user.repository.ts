import { prisma } from "@360crd/database";
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
}
