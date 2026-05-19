import type { FastifyRequest, FastifyReply } from "fastify";
import { IncidentService } from "./incident.service";
import {
  CreateIncidentDto, UpdateIncidentDto, ListIncidentsDto,
  CreateCAPADto, UpdateCAPADto,
} from "./incident.dto";
import { ValidationError } from "../../shared/errors/http.errors";

const service = new IncidentService();

export class IncidentController {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const body = CreateIncidentDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const req = request as any;
    const incident = await service.create(req.tenantId, req.userId, body.data, {
      ipAddress: request.ip,
      requestId: req.requestId,
    });

    return reply.status(201).send({ success: true, data: incident });
  }

  async findOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const req = request as any;
    const incident = await service.findById(id, req.userId, req.isSuperAdmin);
    return reply.send({ success: true, data: incident });
  }

  async findMany(request: FastifyRequest, reply: FastifyReply) {
    const query = ListIncidentsDto.safeParse(request.query);
    if (!query.success) throw new ValidationError("Invalid query", query.error.errors);

    const req = request as any;
    const result = await service.findMany(req.tenantId, query.data);
    return reply.send({ success: true, ...result });
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = UpdateIncidentDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const req = request as any;
    const incident = await service.update(id, req.tenantId, req.userId, body.data, {
      ipAddress: request.ip,
      requestId: req.requestId,
    });
    return reply.send({ success: true, data: incident });
  }

  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const req = request as any;
    await service.delete(id, req.tenantId, req.userId);
    return reply.status(204).send();
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const { dateFrom, dateTo } = request.query as any;
    const req = request as any;
    const stats = await service.getStats(req.tenantId, dateFrom, dateTo);
    return reply.send({ success: true, data: stats });
  }

  async createCAPA(request: FastifyRequest, reply: FastifyReply) {
    const { id: incidentId } = request.params as { id: string };
    const body = CreateCAPADto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const req = request as any;
    const capa = await service.createCAPA(incidentId, req.tenantId, req.userId, body.data);
    return reply.status(201).send({ success: true, data: capa });
  }

  async updateCAPA(request: FastifyRequest, reply: FastifyReply) {
    const { capaId } = request.params as { capaId: string };
    const body = UpdateCAPADto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Validation failed", body.error.errors);

    const req = request as any;
    const capa = await service.updateCAPA(capaId, req.tenantId, req.userId, body.data);
    return reply.send({ success: true, data: capa });
  }
}
