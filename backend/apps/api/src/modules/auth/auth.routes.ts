import type { FastifyInstance } from "fastify";
import { AuthController } from "./auth.controller";
import { authenticate } from "../../middleware/authenticate";
import { resolveTenant } from "../../middleware/tenant-resolve";

const ctrl = new AuthController();

export default async function authRoutes(fastify: FastifyInstance) {
  // All auth routes require tenant resolution
  fastify.addHook("preHandler", resolveTenant);

  // ── Public ──────────────────────────────────────────────────────────────
  fastify.post("/login", {
    config: { rateLimit: { max: 10, timeWindow: 900000 } },
    handler: ctrl.login.bind(ctrl),
  });

  fastify.post("/mfa/verify", {
    config: { rateLimit: { max: 10, timeWindow: 300000 } },
    handler: ctrl.mfaLogin.bind(ctrl),
  });

  fastify.post("/refresh", {
    config: { rateLimit: { max: 20, timeWindow: 60000 } },
    handler: ctrl.refreshToken.bind(ctrl),
  });

  fastify.post("/forgot-password", {
    config: { rateLimit: { max: 5, timeWindow: 900000 } },
    handler: ctrl.forgotPassword.bind(ctrl),
  });

  fastify.post("/reset-password", {
    config: { rateLimit: { max: 5, timeWindow: 900000 } },
    handler: ctrl.resetPassword.bind(ctrl),
  });

  // ── Authenticated ────────────────────────────────────────────────────────
  fastify.register(async (auth) => {
    auth.addHook("preHandler", authenticate);

    auth.post("/logout", ctrl.logout.bind(ctrl));
    auth.get("/me", ctrl.me.bind(ctrl));
    auth.post("/change-password", ctrl.changePassword.bind(ctrl));
    auth.post("/mfa/setup", ctrl.setupMfa.bind(ctrl));
    auth.post("/mfa/confirm", ctrl.confirmMfa.bind(ctrl));
    auth.delete("/mfa", ctrl.disableMfa.bind(ctrl));
  });
}
