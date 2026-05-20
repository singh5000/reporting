import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { RequestContext } from "@360crd/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// AsyncLocalStorage for propagating request context throughout the call stack.
// This eliminates prop-drilling and enables tenant isolation in services/repos.
// ─────────────────────────────────────────────────────────────────────────────
export const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext {
  const ctx = requestContextStore.getStore();
  if (!ctx) throw new Error("Request context not initialized");
  return ctx;
}

export function getRequestContextSafe(): RequestContext | undefined {
  return requestContextStore.getStore();
}

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
    tenantId: string;
    tenantSlug: string;
    userId?: string;
    sessionId?: string;
    isSuperAdmin: boolean;
    roles: string[];
    permissions: string[];
  }
}

export async function requestContextPlugin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId =
    (request.headers["x-request-id"] as string) || randomUUID();

  reply.header("x-request-id", requestId);
  (request as any).requestId = requestId;
}
