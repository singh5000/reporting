import { z } from "zod";

export const CreateSiteDto = z.object({
  name: z.string().min(2).max(200).trim(),
  code: z.string().max(50).optional(),
  type: z.enum(["FACILITY", "WAREHOUSE", "OFFICE", "CONSTRUCTION", "REMOTE", "RETAIL", "OTHER"]).default("FACILITY"),
  status: z.enum(["ACTIVE", "INACTIVE", "UNDER_CONSTRUCTION", "CLOSED"]).default("ACTIVE"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  timezone: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  customerId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateSiteDto = CreateSiteDto.partial();

export const ListSitesDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "UNDER_CONSTRUCTION", "CLOSED"]).optional(),
  type: z.enum(["FACILITY", "WAREHOUSE", "OFFICE", "CONSTRUCTION", "REMOTE", "RETAIL", "OTHER"]).optional(),
  customerId: z.string().optional(),
  sortBy: z.enum(["name", "createdAt", "city"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export type CreateSiteDtoType = z.infer<typeof CreateSiteDto>;
export type UpdateSiteDtoType = z.infer<typeof UpdateSiteDto>;
export type ListSitesDtoType = z.infer<typeof ListSitesDto>;
