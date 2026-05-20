import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError } from "../shared/errors/http.errors";
import type { TenantPlan } from "@360crd/shared-types";

// Plan hierarchy — higher index = more features
const PLAN_LEVEL: Record<TenantPlan, number> = {
  STARTER: 0,
  PROFESSIONAL: 1,
  ENTERPRISE: 2,
  WHITE_LABEL: 3,
};

// Feature → minimum plan required
const FEATURE_PLAN_GATE: Record<string, TenantPlan> = {
  "waste_management":      "PROFESSIONAL",
  "asset_management":      "PROFESSIONAL",
  "advanced_reports":      "PROFESSIONAL",
  "pdf_export":            "PROFESSIONAL",
  "webhooks":              "PROFESSIONAL",
  "api_keys":              "PROFESSIONAL",
  "custom_roles":          "ENTERPRISE",
  "sso":                   "ENTERPRISE",
  "custom_domain":         "WHITE_LABEL",
  "white_label_branding":  "WHITE_LABEL",
  "custom_smtp":           "WHITE_LABEL",
};

// ── Plan-level guard — blocks if tenant's plan is below required ──────────────
export function requirePlan(minimumPlan: TenantPlan) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;
    if (req.isSuperAdmin) return;

    const tenantPlan: TenantPlan = req.tenant?.plan ?? "STARTER";
    if (PLAN_LEVEL[tenantPlan] < PLAN_LEVEL[minimumPlan]) {
      throw new ForbiddenError(
        `This feature requires the ${minimumPlan} plan or above. Current plan: ${tenantPlan}`
      );
    }
  };
}

// ── Feature-flag guard — blocks if feature is disabled in tenant config ────────
export function requireFeature(feature: string) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;
    if (req.isSuperAdmin) return;

    // Check plan gate first
    const gatePlan = FEATURE_PLAN_GATE[feature];
    if (gatePlan) {
      const tenantPlan: TenantPlan = req.tenant?.plan ?? "STARTER";
      if (PLAN_LEVEL[tenantPlan] < PLAN_LEVEL[gatePlan]) {
        throw new ForbiddenError(
          `Feature '${feature}' requires the ${gatePlan} plan. Current plan: ${tenantPlan}`
        );
      }
    }

    // Check per-tenant feature flag
    const features: Record<string, boolean> = req.tenant?.config?.features ?? {};
    if (features[feature] === false) {
      throw new ForbiddenError(`Feature '${feature}' is disabled for your organization`);
    }
  };
}
