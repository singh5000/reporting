import type { FastifyInstance } from "fastify";
import { IncidentController } from "./incident.controller";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";

const ctrl = new IncidentController();

export default async function incidentRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", authenticate);

  fastify.get("/stats", { preHandler: [authorize("incident:read")] }, ctrl.getStats.bind(ctrl));
  fastify.get("/", { preHandler: [authorize("incident:read")] }, ctrl.findMany.bind(ctrl));
  fastify.post("/", { preHandler: [authorize("incident:create")] }, ctrl.create.bind(ctrl));
  fastify.get("/:id", { preHandler: [authorize("incident:read")] }, ctrl.findOne.bind(ctrl));
  fastify.patch("/:id", { preHandler: [authorize("incident:update")] }, ctrl.update.bind(ctrl));
  fastify.delete("/:id", { preHandler: [authorize("incident:delete")] }, ctrl.remove.bind(ctrl));

  // CAPA sub-resource
  fastify.post("/:id/capas", { preHandler: [authorize("incident:update")] }, ctrl.createCAPA.bind(ctrl));
  fastify.patch("/:id/capas/:capaId", { preHandler: [authorize("incident:update")] }, ctrl.updateCAPA.bind(ctrl));
}
