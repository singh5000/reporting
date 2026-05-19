import { BaseError } from "./base.error";

export class BadRequestError extends BaseError {
  readonly statusCode = 400;
  readonly code = "BAD_REQUEST";
}

export class UnauthorizedError extends BaseError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends BaseError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "Insufficient permissions") {
    super(message);
  }
}

export class NotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";
  constructor(resource = "Resource", id?: string) {
    super(id ? `${resource} with id '${id}' not found` : `${resource} not found`);
  }
}

export class ConflictError extends BaseError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";
}

export class ValidationError extends BaseError {
  readonly statusCode = 422;
  readonly code = "VALIDATION_ERROR";
  constructor(message: string, public readonly errors: unknown) {
    super(message, errors);
  }
}

export class TooManyRequestsError extends BaseError {
  readonly statusCode = 429;
  readonly code = "TOO_MANY_REQUESTS";
  constructor(message = "Rate limit exceeded") {
    super(message);
  }
}

export class InternalServerError extends BaseError {
  readonly statusCode = 500;
  readonly code = "INTERNAL_SERVER_ERROR";
  readonly isOperational = false;
  constructor(message = "An unexpected error occurred") {
    super(message);
  }
}

export class ServiceUnavailableError extends BaseError {
  readonly statusCode = 503;
  readonly code = "SERVICE_UNAVAILABLE";
}

export class TenantNotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly code = "TENANT_NOT_FOUND";
  constructor(identifier: string) {
    super(`Tenant '${identifier}' not found or inactive`);
  }
}

export class TenantSuspendedError extends BaseError {
  readonly statusCode = 403;
  readonly code = "TENANT_SUSPENDED";
  constructor() {
    super("This tenant account has been suspended. Please contact support.");
  }
}

export class AccountLockedError extends BaseError {
  readonly statusCode = 423;
  readonly code = "ACCOUNT_LOCKED";
  constructor(public readonly lockedUntil?: Date) {
    super(
      lockedUntil
        ? `Account locked until ${lockedUntil.toISOString()}`
        : "Account is locked due to too many failed login attempts"
    );
  }
}

export class TokenExpiredError extends BaseError {
  readonly statusCode = 401;
  readonly code = "TOKEN_EXPIRED";
  constructor() {
    super("Token has expired");
  }
}

export class InvalidTokenError extends BaseError {
  readonly statusCode = 401;
  readonly code = "INVALID_TOKEN";
  constructor() {
    super("Token is invalid or revoked");
  }
}
