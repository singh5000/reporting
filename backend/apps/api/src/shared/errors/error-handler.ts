import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { BaseError } from "./base.error";
import { ValidationError, InternalServerError } from "./http.errors";
import { logger } from "@360crd/logger";

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id as string;

  // ── Zod validation error ────────────────────────────────────────────────
  if (error instanceof ZodError) {
    const formattedErrors = error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    reply.status(422).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: formattedErrors,
        requestId,
      },
    });
    return;
  }

  // ── Operational errors (expected, safe to expose) ───────────────────────
  if (error instanceof BaseError && error.isOperational) {
    if (error.statusCode >= 500) {
      logger.error("Operational server error", {
        requestId,
        error: error.message,
        code: error.code,
        stack: error.stack,
      });
    }
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    });
    return;
  }

  // ── Fastify built-in errors ─────────────────────────────────────────────
  if ("statusCode" in error && typeof error.statusCode === "number") {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code || "HTTP_ERROR",
        message: error.message,
        requestId,
      },
    });
    return;
  }

  // ── Unhandled / programming errors ─────────────────────────────────────
  logger.error("Unhandled error", {
    requestId,
    tenantId: (request as any).tenantId,
    userId: (request as any).userId,
    method: request.method,
    url: request.url,
    error: error.message,
    stack: error.stack,
  });

  const internalError = new InternalServerError();
  reply.status(500).send({
    success: false,
    error: {
      code: internalError.code,
      message: internalError.message,
      requestId,
    },
  });
}
