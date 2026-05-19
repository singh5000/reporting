import { z } from "zod";

export const CreateUserDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).optional(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employeeId: z.string().optional(),
  type: z.enum(["TENANT_ADMIN", "MANAGER", "STAFF", "CUSTOMER"]).default("STAFF"),
  roles: z.array(z.string()).default([]),
  siteIds: z.array(z.string()).optional(),
  sendWelcomeEmail: z.boolean().default(true),
  mustChangePassword: z.boolean().default(true),
});

export const UpdateUserDto = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  employeeId: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
  avatarUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AssignRoleDto = z.object({
  roleId: z.string().min(1),
  siteId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export const ListUsersDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  roleSlug: z.string().optional(),
  siteId: z.string().optional(),
  sortBy: z.enum(["firstName", "lastName", "email", "createdAt", "lastLoginAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateUserDtoType = z.infer<typeof CreateUserDto>;
export type UpdateUserDtoType = z.infer<typeof UpdateUserDto>;
export type ListUsersDtoType = z.infer<typeof ListUsersDto>;
export type AssignRoleDtoType = z.infer<typeof AssignRoleDto>;
