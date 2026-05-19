import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { DomainEvent } from "@360crd/shared-types";

// ─────────────────────────────────────────────────────────────────────────────
// In-process Event Bus (upgradeable to Redis Pub/Sub for microservices)
// ─────────────────────────────────────────────────────────────────────────────
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  publish<T = unknown>(event: Omit<DomainEvent<T>, "id" | "timestamp" | "version">): void {
    const fullEvent: DomainEvent<T> = {
      id: randomUUID(),
      version: 1,
      timestamp: new Date(),
      ...event,
    };

    this.emit(fullEvent.type, fullEvent);
    this.emit("*", fullEvent); // wildcard listeners
  }

  subscribe<T = unknown>(
    eventType: string,
    handler: (event: DomainEvent<T>) => void | Promise<void>
  ): () => void {
    const wrappedHandler = async (event: DomainEvent<T>) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(`[EventBus] Handler error for ${eventType}:`, err);
      }
    };

    this.on(eventType, wrappedHandler);
    return () => this.off(eventType, wrappedHandler);
  }
}

export const eventBus = EventBus.getInstance();

// ── Domain Event Types ─────────────────────────────────────────────────────
export const Events = {
  // Auth
  USER_LOGGED_IN: "auth.user.logged_in",
  USER_LOGGED_OUT: "auth.user.logged_out",
  USER_LOGIN_FAILED: "auth.user.login_failed",
  USER_PASSWORD_CHANGED: "auth.user.password_changed",
  USER_MFA_ENABLED: "auth.user.mfa_enabled",

  // Tenant
  TENANT_CREATED: "tenant.created",
  TENANT_UPDATED: "tenant.updated",
  TENANT_SUSPENDED: "tenant.suspended",
  TENANT_ACTIVATED: "tenant.activated",

  // User
  USER_CREATED: "user.created",
  USER_UPDATED: "user.updated",
  USER_DELETED: "user.deleted",
  USER_VERIFIED: "user.verified",
  USER_SUSPENDED: "user.suspended",
  USER_ROLE_ASSIGNED: "user.role_assigned",
  USER_ROLE_REVOKED: "user.role_revoked",

  // Incident
  INCIDENT_CREATED: "incident.created",
  INCIDENT_UPDATED: "incident.updated",
  INCIDENT_ASSIGNED: "incident.assigned",
  INCIDENT_CLOSED: "incident.closed",
  INCIDENT_CAPA_CREATED: "incident.capa.created",
  INCIDENT_CAPA_COMPLETED: "incident.capa.completed",
  INCIDENT_CAPA_OVERDUE: "incident.capa.overdue",

  // Audit
  AUDIT_CREATED: "audit.created",
  AUDIT_STARTED: "audit.started",
  AUDIT_COMPLETED: "audit.completed",
  AUDIT_FINDING_CREATED: "audit.finding.created",
  AUDIT_DUE_REMINDER: "audit.due_reminder",

  // Training
  TRAINING_ENROLLMENT_CREATED: "training.enrollment.created",
  TRAINING_COMPLETED: "training.completed",
  TRAINING_CERTIFICATE_ISSUED: "training.certificate_issued",
  TRAINING_EXPIRY_REMINDER: "training.expiry_reminder",

  // Notification
  NOTIFICATION_SEND: "notification.send",

  // Report
  REPORT_REQUESTED: "report.requested",
  REPORT_COMPLETED: "report.completed",
  REPORT_FAILED: "report.failed",
} as const;

export type EventType = (typeof Events)[keyof typeof Events];
export type { DomainEvent };
