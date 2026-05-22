import { z } from "zod";

// ── Template DTOs ─────────────────────────────────────────────────────────────
export const CreateTemplateDto = z.object({
  name: z.string().min(3).max(200).trim(),
  description: z.string().optional(),
  category: z.string().optional(),
  industry: z.string().optional(),
  estimatedMins: z.number().min(1).optional(),
  passingScore: z.number().min(0).max(100).optional(),
  isPublic: z.boolean().default(false),
});

export const UpdateTemplateDto = CreateTemplateDto.partial();

export const CreateSectionDto = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().optional(),
  order: z.number().min(0),
  weight: z.number().min(1).max(100).default(100),
});

export const CreateQuestionDto = z.object({
  text: z.string().min(1).trim(),
  type: z.enum(["YES_NO", "MULTIPLE_CHOICE", "SINGLE_CHOICE", "TEXT", "NUMBER", "RATING", "DATE", "PHOTO", "SIGNATURE"]),
  isRequired: z.boolean().default(true),
  weight: z.number().min(1).default(1),
  order: z.number().min(0),
  options: z.array(z.string()).optional(),
  expectedAnswer: z.string().optional(),
  helpText: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  unit: z.string().optional(),
});

// ── Audit DTOs ────────────────────────────────────────────────────────────────
export const CreateAuditDto = z.object({
  tenantId: z.string().optional(),
  templateId: z.string().optional(),
  siteId: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  title: z.string().min(3).max(300).trim(),
  description: z.string().optional(),
  type: z.enum(["SCHEDULED", "UNANNOUNCED", "FOLLOW_UP", "COMPLIANCE", "INTERNAL", "EXTERNAL"]).default("SCHEDULED"),
  scheduledAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

export const ListAuditsDto = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.string().optional(),
  siteId: z.string().optional(),
  assignedToId: z.string().optional(),
  type: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "dueDate", "scheduledAt", "percentage"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const SubmitAuditDto = z.object({
  responses: z.array(z.object({
    questionId: z.string(),
    question: z.string(),
    questionType: z.string(),
    answer: z.string().optional(),
    numericAnswer: z.number().optional(),
    booleanAnswer: z.boolean().optional(),
    selectedOptions: z.array(z.string()).default([]),
    notes: z.string().optional(),
    evidenceUrls: z.array(z.string()).default([]),
  })),
  notes: z.string().optional(),
});

export const CreateFindingDto = z.object({
  type: z.enum(["NON_CONFORMANCE", "OBSERVATION", "OPPORTUNITY", "POSITIVE_FINDING"]),
  title: z.string().min(3).max(300).trim(),
  description: z.string().min(1),
  severity: z.enum(["MAJOR", "MINOR", "OBSERVATION"]),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.string().optional(),
  evidenceUrls: z.array(z.string()).default([]),
});

export const ReviewAuditDto = z.object({
  notes: z.string().optional(),
  conclusion: z.string().optional(),
  action: z.enum(["approve", "reject"]),
  rejectReason: z.string().optional(),
});

export type CreateTemplateDtoType = z.infer<typeof CreateTemplateDto>;
export type CreateSectionDtoType = z.infer<typeof CreateSectionDto>;
export type CreateQuestionDtoType = z.infer<typeof CreateQuestionDto>;
export type CreateAuditDtoType = z.infer<typeof CreateAuditDto>;
export type ListAuditsDtoType = z.infer<typeof ListAuditsDto>;
export type SubmitAuditDtoType = z.infer<typeof SubmitAuditDto>;
export type CreateFindingDtoType = z.infer<typeof CreateFindingDto>;
