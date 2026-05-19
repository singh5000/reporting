import fastifyPlugin from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import redis from "@360crd/cache";
import { config } from "../config";

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    redis,
    keyGenerator(request) {
      // Tenant-aware rate limiting key
      const tenantId = (request as any).tenantId;
      const userId = (request as any).userId;
      if (userId) return `${tenantId}:${userId}`;
      return request.ip;
    },
    errorResponseBuilder(_request, context) {
      return {
        success: false,
        error: {
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds.`,
          retryAfter: context.ttl,
        },
      };
    },
  });
});
