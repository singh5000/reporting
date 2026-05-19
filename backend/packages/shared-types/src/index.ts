// =============================================================================
// 360CRD Shared Types
// =============================================================================

// ── Request Context ────────────────────────────────────────────────────────
export interface RequestContext {
  requestId: string;
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  sessionId?: string;
  userType?: UserType;
  roles?: string[];
  permissions?: string[];
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  isSuperAdmin?: boolean;
  skipTenantFilter?: boolean;
}

// ── Auth ───────────────────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;        // userId
  tid: string;        // tenantId
  tsl: string;        // tenantSlug
  sid: string;        // sessionId
  typ: UserType;
  roles: string[];
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;        // userId
  tid: string;        // tenantId
  fam: string;        // family (rotation detection)
  jti: string;        // token ID
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
}

export interface LoginResult {
  user: SafeUser;
  tokens: AuthTokens;
  sessionId: string;
  requiresMfa?: boolean;
  mfaToken?: string;
}

// ── User ───────────────────────────────────────────────────────────────────
export type UserType =
  | "SUPER_ADMIN"
  | "TENANT_ADMIN"
  | "MANAGER"
  | "STAFF"
  | "CUSTOMER";

export type UserStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "PENDING_VERIFICATION";

export interface SafeUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarUrl: string | null;
  type: UserType;
  status: UserStatus;
  department: string | null;
  jobTitle: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  createdAt: Date;
}

// ── Tenant ─────────────────────────────────────────────────────────────────
export interface TenantResolution {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  plan: TenantPlan;
  timezone: string;
  locale: string;
  branding?: TenantBrandingPublic;
  config?: TenantConfigPublic;
}

export type TenantStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type TenantPlan = "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "WHITE_LABEL";

export interface TenantBrandingPublic {
  appName: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBgUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
}

export interface TenantConfigPublic {
  features: Record<string, boolean>;
  mfaRequired: boolean;
  sessionTimeoutMins: number;
  notifChannels: string[];
}

// ── Pagination ─────────────────────────────────────────────────────────────
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ── API Response ───────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

// ── Events ─────────────────────────────────────────────────────────────────
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  tenantId: string;
  userId?: string;
  payload: T;
  timestamp: Date;
  version: number;
}

// ── File Upload ────────────────────────────────────────────────────────────
export interface UploadedFile {
  fieldname: string;
  filename: string;
  mimetype: string;
  encoding: string;
  size: number;
  url: string;
  key: string;
  checksum: string;
}

// ── Permission ─────────────────────────────────────────────────────────────
export interface PermissionCheck {
  resource: string;
  action: string;
  scope?: "GLOBAL" | "TENANT" | "SITE" | "OWN";
}

// ── Audit Log ──────────────────────────────────────────────────────────────
export interface AuditLogEntry {
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  requestId?: string;
  status?: "SUCCESS" | "FAILURE";
  error?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

// ── Queue Jobs ─────────────────────────────────────────────────────────────
export interface EmailJob {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlBody: string;
  textBody?: string;
  from?: { name: string; email: string };
  replyTo?: string;
  tenantId?: string;
  templateId?: string;
  variables?: Record<string, unknown>;
}

export interface NotificationJob {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel: "email" | "push" | "sms" | "in-app";
  data?: Record<string, unknown>;
  pushToken?: string;
}

export interface ReportJob {
  tenantId: string;
  reportId: string;
  type: string;
  parameters: Record<string, unknown>;
  filters: Record<string, unknown>;
  requestedById: string;
}

// ── WebSocket ──────────────────────────────────────────────────────────────
export interface WsMessage<T = unknown> {
  event: string;
  data: T;
  tenantId?: string;
  userId?: string;
  timestamp: string;
}
