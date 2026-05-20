import { IncidentRepository } from "./incident.repository";
import type { CreateIncidentDtoType, UpdateIncidentDtoType, ListIncidentsDtoType, CreateCAPADtoType, UpdateCAPADtoType } from "./incident.dto";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { eventBus, Events } from "@360crd/event-bus";
import { notificationQueue } from "@360crd/queue";
import { NotFoundError, ForbiddenError } from "../../shared/errors/http.errors";

const auditLog = new AuditLogService();

export class IncidentService {
  private repo = new IncidentRepository();

  async create(
    tenantId: string,
    reportedById: string,
    dto: CreateIncidentDtoType,
    meta: { ipAddress?: string; requestId?: string }
  ) {
    const refNumber = await this.repo.generateRefNumber(tenantId);
    const incident = await this.repo.create(tenantId, reportedById, refNumber, dto);

    await auditLog.log({
      tenantId,
      userId: reportedById,
      action: "CREATE",
      resource: "incident",
      resourceId: incident.id,
      after: { id: incident.id, refNumber, severity: dto.severity },
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });

    eventBus.publish({
      type: Events.INCIDENT_CREATED,
      tenantId,
      userId: reportedById,
      payload: { incidentId: incident.id, refNumber, severity: dto.severity, siteId: dto.siteId },
    });

    if (dto.assignedToId) {
      await notificationQueue.add("incident-assigned", {
        tenantId,
        userId: dto.assignedToId,
        type: "incident_assigned",
        title: "Incident Assigned",
        message: `You have been assigned incident ${refNumber}: ${dto.title}`,
        channel: "in-app",
        data: { incidentId: incident.id, refNumber },
      });
    }

    if (dto.severity === "CRITICAL") {
      await notificationQueue.add(
        "incident-critical",
        {
          tenantId,
          userId: reportedById,
          type: "incident_critical",
          title: "CRITICAL Incident Reported",
          message: `Critical incident ${refNumber} requires immediate attention`,
          channel: "email",
          data: { incidentId: incident.id },
        },
        { priority: 1 }
      );
    }

    return incident;
  }

  async findById(id: string) {
    const incident = await this.repo.findById(id);
    if (!incident) throw new NotFoundError("Incident", id);
    return incident;
  }

  async findMany(tenantId: string, query: ListIncidentsDtoType, restrictToSiteIds?: string[]) {
    return this.repo.findMany(tenantId, query, restrictToSiteIds);
  }

  async update(
    id: string,
    tenantId: string,
    userId: string,
    dto: UpdateIncidentDtoType,
    meta: { ipAddress?: string; requestId?: string }
  ) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Incident", id);

    const updated = await this.repo.update(id, {
      ...dto,
      ...(dto.status === "CLOSED" ? { closedAt: new Date() } : {}),
      ...(dto.occurredAt ? { occurredAt: new Date(dto.occurredAt) } : {}),
    });

    await auditLog.log({
      tenantId,
      userId,
      action: "UPDATE",
      resource: "incident",
      resourceId: id,
      before: { status: existing.status, severity: existing.severity },
      after: { status: dto.status, severity: dto.severity },
      ipAddress: meta.ipAddress,
      requestId: meta.requestId,
    });

    if (dto.status === "CLOSED" && existing.status !== "CLOSED") {
      eventBus.publish({
        type: Events.INCIDENT_CLOSED,
        tenantId,
        userId,
        payload: { incidentId: id, refNumber: existing.refNumber },
      });
    }

    if (dto.assignedToId && dto.assignedToId !== existing.assignedToId) {
      eventBus.publish({
        type: Events.INCIDENT_ASSIGNED,
        tenantId,
        userId,
        payload: { incidentId: id, assignedToId: dto.assignedToId },
      });
    }

    return updated;
  }

  async delete(id: string, tenantId: string, userId: string) {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundError("Incident", id);

    await this.repo.softDelete(id);

    await auditLog.log({
      tenantId,
      userId,
      action: "DELETE",
      resource: "incident",
      resourceId: id,
      before: { id, refNumber: existing.refNumber },
    });
  }

  async createCAPA(incidentId: string, tenantId: string, userId: string, dto: CreateCAPADtoType) {
    const incident = await this.repo.findById(incidentId);
    if (!incident) throw new NotFoundError("Incident", incidentId);

    const capa = await this.repo.createCAPA(tenantId, incidentId, {
      ...dto,
      status: "OPEN",
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    await auditLog.log({
      tenantId,
      userId,
      action: "CREATE",
      resource: "incident_capa",
      resourceId: capa.id,
      after: { incidentId, type: dto.type, title: dto.title },
    });

    eventBus.publish({
      type: Events.INCIDENT_CAPA_CREATED,
      tenantId,
      userId,
      payload: { capaId: capa.id, incidentId, type: dto.type },
    });

    return capa;
  }

  async updateCAPA(capaId: string, tenantId: string, userId: string, dto: UpdateCAPADtoType) {
    const existing = await this.repo.findCapaById(capaId);
    if (!existing) throw new NotFoundError("CAPA", capaId);

    const updated = await this.repo.updateCAPA(capaId, {
      ...dto,
      ...(dto.status === "COMPLETED" ? { completedAt: new Date() } : {}),
    });

    await auditLog.log({
      tenantId,
      userId,
      action: "UPDATE",
      resource: "incident_capa",
      resourceId: capaId,
      before: { status: existing.status },
      after: { status: dto.status },
    });

    if (dto.status === "COMPLETED" && existing.status !== "COMPLETED") {
      eventBus.publish({
        type: Events.INCIDENT_CAPA_COMPLETED,
        tenantId,
        userId,
        payload: { capaId },
      });
    }

    return updated;
  }

  async getStats(tenantId: string, dateFrom?: string, dateTo?: string, siteIds?: string[]) {
    return this.repo.getStats(
      tenantId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
      siteIds
    );
  }
}
