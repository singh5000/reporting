/**
 * Centralized API endpoint registry.
 * Base URL → VITE_API_BASE_URL (http://localhost:3000/api/v1).
 * All paths here are relative to that base.
 *
 * NAMING NOTE:
 *   Frontend "companies"  → API "/tenants"
 *   Frontend "facilities" → API "/sites"
 */
export const ENDPOINTS = {
  auth: {
    login:          "/auth/login",
    logout:         "/auth/logout",
    me:             "/auth/me",
    refresh:        "/auth/refresh",
    forgotPassword: "/auth/forgot-password",
    resetPassword:  "/auth/reset-password",
    changePassword: "/auth/change-password",
  },

  users: {
    list:         "/users",
    me:           "/users/me",
    detail:       (id: string) => `/users/${id}`,
    create:       "/users",
    update:       (id: string) => `/users/${id}`,
    remove:       (id: string) => `/users/${id}`,
    status:       (id: string) => `/users/${id}/status`,
    roles:        (id: string) => `/users/${id}/roles`,
    revokeRole:   (id: string, roleId: string) => `/users/${id}/roles/${roleId}`,
    resendInvite: (id: string) => `/users/${id}/resend-invite`,
    notifications: "/users/me/notifications",
    preferences:  "/users/me/preferences",
  },

  companies: {
    list:    "/tenants",
    detail:  (id: string) => `/tenants/${id}`,
    create:  "/tenants",
    update:  (id: string) => `/tenants/${id}`,
    branding: "/tenants/me/branding",
  },

  facilities: {
    list:      "/sites",
    detail:    (id: string) => `/sites/${id}`,
    create:    "/sites",
    update:    (id: string) => `/sites/${id}`,
    remove:    (id: string) => `/sites/${id}`,
    incidents: (id: string) => `/sites/${id}/incidents`,
    audits:    (id: string) => `/sites/${id}/audits`,
  },

  incidents: {
    list:       "/incidents",
    detail:     (id: string) => `/incidents/${id}`,
    create:     "/incidents",
    update:     (id: string) => `/incidents/${id}`,
    remove:     (id: string) => `/incidents/${id}`,
    status:     (id: string) => `/incidents/${id}/status`,
    capa:       (id: string) => `/incidents/${id}/capa`,
    evidence:   (id: string) => `/incidents/${id}/evidence`,
    stats:      "/incidents/stats",
  },

  audits: {
    list:         "/audits",
    detail:       (id: string) => `/audits/${id}`,
    create:       "/audits",
    update:       (id: string) => `/audits/${id}`,
    remove:       (id: string) => `/audits/${id}`,
    status:       (id: string) => `/audits/${id}/status`,
    responses:    (id: string) => `/audits/${id}/responses`,
    findings:     (id: string) => `/audits/${id}/findings`,
    stats:        "/audits/stats",
    templates:    "/audit-templates",
  },

  training: {
    list:        "/training",
    detail:      (id: string) => `/training/${id}`,
    create:      "/training",
    update:      (id: string) => `/training/${id}`,
    enroll:      (id: string) => `/training/${id}/enroll`,
    quiz:        (id: string) => `/training/${id}/quiz`,
    certificate: (id: string, userId: string) => `/training/${id}/certificate/${userId}`,
    my:          "/training/my",
  },

  ppe: {
    list:     "/ppe",
    detail:   (id: string) => `/ppe/${id}`,
    create:   "/ppe",
    update:   (id: string) => `/ppe/${id}`,
    assign:   (id: string) => `/ppe/${id}/assign`,
    return:   (id: string) => `/ppe/${id}/return`,
    expiring: "/ppe/expiring",
    stats:    "/ppe/stats",
  },

  assets: {
    list:   "/assets",
    detail: (id: string) => `/assets/${id}`,
    create: "/assets",
    update: (id: string) => `/assets/${id}`,
    remove: (id: string) => `/assets/${id}`,
    assign: (id: string) => `/assets/${id}/assign`,
    return: (id: string) => `/assets/${id}/return`,
    stats:  "/assets/stats",
  },

  waste: {
    list:   "/waste",
    detail: (id: string) => `/waste/${id}`,
    create: "/waste",
    update: (id: string) => `/waste/${id}`,
    stats:  "/waste/stats",
  },

  documents: {
    list:     "/documents",
    detail:   (id: string) => `/documents/${id}`,
    upload:   "/documents/upload",
    download: (id: string) => `/documents/${id}/download`,
    remove:   (id: string) => `/documents/${id}`,
  },

  notifications: {
    list:    "/notifications",
    count:   "/notifications/count",
    read:    (id: string) => `/notifications/${id}/read`,
    readAll: "/notifications/read-all",
    remove:  (id: string) => `/notifications/${id}`,
  },

  reports: {
    list:     "/reports",
    detail:   (id: string) => `/reports/${id}`,
    create:   "/reports",
    download: (id: string) => `/reports/${id}/download`,
    remove:   (id: string) => `/reports/${id}`,
  },

  dashboard: {
    metrics:           "/dashboard/metrics",
    auditTrend:        "/dashboard/audit-trend",
    incidentBreakdown: "/dashboard/incident-breakdown",
    activityFeed:      "/dashboard/activity-feed",
  },

  activity: {
    list:      "/activity",
    auditLogs: "/activity/audit-logs",
  },

  roles: {
    list: "/roles",
  },
} as const;

export type Endpoints = typeof ENDPOINTS;
