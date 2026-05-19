import fastifyPlugin from "fastify-plugin";
import websocket from "@fastify/websocket";
import type { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import type { JwtPayload, WsMessage } from "@360crd/shared-types";
import { config } from "../config";
import { logger } from "@360crd/logger";

// ── Tenant-aware WebSocket connection registry ────────────────────────────
const tenantConnections = new Map<string, Set<import("ws").WebSocket>>();
const userConnections = new Map<string, Set<import("ws").WebSocket>>();

export function broadcastToTenant<T>(tenantId: string, message: WsMessage<T>): void {
  const conns = tenantConnections.get(tenantId);
  if (!conns) return;
  const payload = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export function broadcastToUser<T>(userId: string, message: WsMessage<T>): void {
  const conns = userConnections.get(userId);
  if (!conns) return;
  const payload = JSON.stringify(message);
  for (const ws of conns) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export default fastifyPlugin(async (fastify: FastifyInstance) => {
  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB
      verifyClient: ({ req }, next) => {
        try {
          const token = new URL(req.url!, "http://x").searchParams.get("token");
          if (!token) return next(false, 401, "Unauthorized");
          jwt.verify(token, config.auth.jwtSecret);
          next(true);
        } catch {
          next(false, 401, "Invalid token");
        }
      },
    },
  });

  fastify.get(
    "/ws",
    { websocket: true },
    (connection, request: FastifyRequest) => {
      const token = (request.query as any).token as string;

      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
      } catch {
        connection.socket.close(4001, "Invalid token");
        return;
      }

      const { sub: userId, tid: tenantId } = payload;

      // Register connection
      if (!tenantConnections.has(tenantId)) tenantConnections.set(tenantId, new Set());
      tenantConnections.get(tenantId)!.add(connection.socket);

      if (!userConnections.has(userId)) userConnections.set(userId, new Set());
      userConnections.get(userId)!.add(connection.socket);

      logger.info("WebSocket connected", { userId, tenantId });

      // Send welcome message
      connection.socket.send(
        JSON.stringify({
          event: "connected",
          data: { message: "WebSocket connection established" },
          timestamp: new Date().toISOString(),
        })
      );

      // Heartbeat
      const pingInterval = setInterval(() => {
        if (connection.socket.readyState === 1) {
          connection.socket.ping();
        }
      }, 30000);

      connection.socket.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          // Handle client messages (subscribe to rooms, etc.)
          if (msg.type === "ping") {
            connection.socket.send(JSON.stringify({ type: "pong" }));
          }
        } catch {
          // ignore malformed messages
        }
      });

      connection.socket.on("close", () => {
        clearInterval(pingInterval);
        tenantConnections.get(tenantId)?.delete(connection.socket);
        userConnections.get(userId)?.delete(connection.socket);
        logger.info("WebSocket disconnected", { userId, tenantId });
      });
    }
  );
});
