import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

const { combine, timestamp, errors, json, colorize, printf, splat } = winston.format;

const LOG_DIR = process.env.LOG_DIR || "./logs";
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ── Custom format ──────────────────────────────────────────────────────────
const consoleFormat = printf(({ level, message, timestamp: ts, requestId, tenantId, userId, ...meta }) => {
  const reqId = requestId ? ` [${requestId}]` : "";
  const tId = tenantId ? ` [T:${tenantId}]` : "";
  const uId = userId ? ` [U:${userId}]` : "";
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} ${level}${reqId}${tId}${uId}: ${message}${extra}`;
});

// ── File transports ────────────────────────────────────────────────────────
const fileRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "30d",
  maxSize: "100m",
  zippedArchive: true,
  level: LOG_LEVEL,
  format: combine(timestamp(), errors({ stack: true }), json()),
});

const errorRotateTransport = new DailyRotateFile({
  filename: path.join(LOG_DIR, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "30d",
  maxSize: "50m",
  zippedArchive: true,
  level: "error",
  format: combine(timestamp(), errors({ stack: true }), json()),
});

// ── Logger factory ─────────────────────────────────────────────────────────
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: "360crd-api" },
  transports: [
    IS_PRODUCTION
      ? fileRotateTransport
      : new winston.transports.Console({
          format: combine(
            colorize({ all: true }),
            timestamp({ format: "HH:mm:ss" }),
            errors({ stack: true }),
            splat(),
            consoleFormat
          ),
        }),
    ...(IS_PRODUCTION ? [errorRotateTransport] : []),
  ],
});

// ── Child logger factory ──────────────────────────────────────────────────
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// ── Request-scoped logger ─────────────────────────────────────────────────
export function requestLogger(meta: {
  requestId: string;
  tenantId?: string;
  userId?: string;
  method?: string;
  url?: string;
}) {
  return logger.child(meta);
}

export default logger;
