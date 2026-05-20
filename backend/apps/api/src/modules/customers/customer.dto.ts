import { z } from "zod";

export const CreateCustomerDto = z.object({
  name: z.string().min(2).max(200).trim(),
  code: z.string().max(50).optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT", "CHURNED"]).default("ACTIVE"),
  contractStart: z.string().datetime().optional(),
  contractEnd: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateCustomerDto = CreateCustomerDto.partial();

export const ListCustomersDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT", "CHURNED"]).optional(),
  industry: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "contractEnd"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const CreateSubUserDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  sendWelcomeEmail: z.boolean().default(true),
});

export type CreateCustomerDtoType = z.infer<typeof CreateCustomerDto>;
export type UpdateCustomerDtoType = z.infer<typeof UpdateCustomerDto>;
export type ListCustomersDtoType = z.infer<typeof ListCustomersDto>;
export type CreateSubUserDtoType = z.infer<typeof CreateSubUserDto>;
