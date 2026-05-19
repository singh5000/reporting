import fastifyPlugin from "fastify-plugin";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "360CRD API",
        description: "Enterprise EHS & Compliance Management Platform API",
        version: "1.0.0",
        contact: { name: "360CRD Support", email: "support@360crd.io" },
      },
      servers: [{ url: "/api/v1", description: "API v1" }],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          ApiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
      security: [{ BearerAuth: [] }],
      tags: [
        { name: "Auth", description: "Authentication & token management" },
        { name: "Tenants", description: "Tenant management" },
        { name: "Users", description: "User management" },
        { name: "Roles", description: "RBAC roles & permissions" },
        { name: "Sites", description: "Site & facility management" },
        { name: "Incidents", description: "EHS incident reporting" },
        { name: "Audits", description: "Audit management" },
        { name: "Training", description: "Training & inductions" },
        { name: "PPE", description: "PPE management" },
        { name: "Assets", description: "Asset management" },
        { name: "Waste", description: "Waste management" },
        { name: "Documents", description: "Document management" },
        { name: "Reports", description: "Reports & analytics" },
        { name: "Notifications", description: "Notification management" },
      ],
    },
  });

  await fastify.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
    staticCSP: true,
    transformSpecificationClone: true,
  });
});
