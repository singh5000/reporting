import { z } from "zod";

export const CreateIncidentDto = z.object({
  siteId: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  title: z.string().min(3).max(500),
  description: z.string().min(10),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  type: z.enum(["INCIDENT", "NEAR_MISS", "HAZARD", "OBSERVATION", "ENVIRONMENTAL"]).default("INCIDENT"),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "NEGLIGIBLE"]).default("MEDIUM"),
  priority: z.number().min(1).max(5).default(3),
  occurredAt: z.string().datetime(),
  location: z.string().optional(),
  injuryType: z.string().optional(),
  bodyPart: z.string().optional(),
  injuredPersons: z.number().min(0).default(0),
  immediateActions: z.string().optional(),
  isAnonymous: z.boolean().default(false),
  isNotifiable: z.boolean().default(false),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateIncidentDto = CreateIncidentDto.partial().extend({
  status: z.enum([
    "REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTIONS",
    "PENDING_CLOSURE", "CLOSED", "CANCELLED",
  ]).optional(),
  rootCause: z.string().optional(),
  closedAt: z.string().datetime().optional(),
});

export const ListIncidentsDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  type: z.string().optional(),
  siteId: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(["occurredAt", "createdAt", "severity", "status"]).default("occurredAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const CreateCAPADto = z.object({
  type: z.enum(["CORRECTIVE", "PREVENTIVE"]).default("CORRECTIVE"),
  title: z.string().min(3),
  description: z.string().min(10),
  assignedToId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
});

export const UpdateCAPADto = CreateCAPADto.partial().extend({
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "CANCELLED"]).optional(),
  effectiveness: z.string().optional(),
});

export type CreateIncidentDtoType = z.infer<typeof CreateIncidentDto>;
export type UpdateIncidentDtoType = z.infer<typeof UpdateIncidentDto>;
export type ListIncidentsDtoType = z.infer<typeof ListIncidentsDto>;
export type CreateCAPADtoType = z.infer<typeof CreateCAPADto>;
export type UpdateCAPADtoType = z.infer<typeof UpdateCAPADto>;
