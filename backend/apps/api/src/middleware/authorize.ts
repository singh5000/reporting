import type { FastifyRequest, FastifyReply } from "fastify";
import { ForbiddenError, UnauthorizedError } from "../shared/errors/http.errors";

type Permission = `${string}:${string}`;

// ─────────────────────────────────────────────────────────────────────────────
// RBAC Authorization Middleware Factory
// Usage: fastify.addHook('preHandler', authorize('incident:create'))
//        fastify.addHook('preHandler', authorizeAny('audit:create', 'audit:read'))
// ─────────────────────────────────────────────────────────────────────────────
export function authorize(...requiredPermissions: Permission[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;

    if (!req.userId) throw new UnauthorizedError();

    // Super admins bypass all permission checks
    if (req.isSuperAdmin) return;

    const userPermissions: string[] = req.permissions || [];

    const hasAll = requiredPermissions.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      throw new ForbiddenError(
        `Required permissions: ${requiredPermissions.join(", ")}`
      );
    }
  };
}

// ── Any permission (OR logic) ──────────────────────────────────────────────
export function authorizeAny(...permissions: Permission[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;

    if (!req.userId) throw new UnauthorizedError();
    if (req.isSuperAdmin) return;

    const userPermissions: string[] = req.permissions || [];
    const hasAny = permissions.some((p) => userPermissions.includes(p));

    if (!hasAny) {
      throw new ForbiddenError(
        `Requires one of: ${permissions.join(", ")}`
      );
    }
  };
}

// ── Role-based guard ────────────────────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;

    if (!req.userId) throw new UnauthorizedError();
    if (req.isSuperAdmin) return;

    const userRoles: string[] = req.roles || [];
    const hasRole = roles.some((r) => userRoles.includes(r));

    if (!hasRole) {
      throw new ForbiddenError(`Requires role: ${roles.join(" or ")}`);
    }
  };
}

// ── Super admin only ─────────────────────────────────────────────────────────
export function requireSuperAdmin() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;
    if (!req.userId) throw new UnauthorizedError();
    if (!req.isSuperAdmin) throw new ForbiddenError("Super admin access required");
  };
}

// ── Tenant admin only ────────────────────────────────────────────────────────
export function requireTenantAdmin() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;
    if (!req.userId) throw new UnauthorizedError();
    if (req.isSuperAdmin) return;

    const userRoles: string[] = req.roles || [];
    const isAdmin = userRoles.includes("tenant_admin");
    if (!isAdmin) throw new ForbiddenError("Tenant admin access required");
  };
}

// ── Ownership guard — allows own resources + admins ──────────────────────────
export function authorizeOwner(getUserIdFromRequest: (req: FastifyRequest) => string | undefined) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const req = request as any;
    if (!req.userId) throw new UnauthorizedError();
    if (req.isSuperAdmin) return;

    const userRoles: string[] = req.roles || [];
    if (userRoles.includes("tenant_admin") || userRoles.includes("manager")) return;

    const resourceOwnerId = getUserIdFromRequest(request);
    if (resourceOwnerId !== req.userId) {
      throw new ForbiddenError("You can only access your own resources");
    }
  };
}
