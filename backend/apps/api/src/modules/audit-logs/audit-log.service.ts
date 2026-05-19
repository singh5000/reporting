import { createHash } from "crypto";
import { basePrisma } from "@360crd/database";
import type { AuditLogEntry } from "@360crd/shared-types";
import { logger } from "@360crd/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Tamper-Proof Audit Log Service
//
// Uses SHA-256 hash chaining (blockchain-inspired) to detect tampering:
//   hash(n) = SHA256( canonicalize(entry_n) + hash(n-1) )
//
// Any modification to a historical record will break the chain.
// Verification can be done by re-computing hashes sequentially.
// ─────────────────────────────────────────────────────────────────────────────
export class AuditLogService {
  private lastHashCache: string | null = null;

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const prevHash = await this.getLastHash(entry.tenantId);
      const canonical = this.canonicalize(entry);
      const hash = createHash("sha256")
        .update(canonical + prevHash)
        .digest("hex");

      await basePrisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          userId: entry.userId,
          sessionId: entry.sessionId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          before: entry.before as any,
          after: entry.after as any,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          deviceId: entry.deviceId,
          requestId: entry.requestId,
          status: entry.status || "SUCCESS",
          error: entry.error,
          durationMs: entry.durationMs,
          metadata: entry.metadata as any,
          hash,
          prevHash,
        },
      });

      this.lastHashCache = hash;
    } catch (err) {
      logger.error("Failed to write audit log", {
        error: (err as Error).message,
        entry: { action: entry.action, resource: entry.resource },
      });
    }
  }

  async verifyIntegrity(tenantId?: string, limit = 1000): Promise<{
    valid: boolean;
    checkedCount: number;
    firstInvalidId?: string;
    firstInvalidAt?: Date;
  }> {
    const logs = await basePrisma.auditLog.findMany({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "asc" },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        userId: true,
        sessionId: true,
        action: true,
        resource: true,
        resourceId: true,
        before: true,
        after: true,
        ipAddress: true,
        userAgent: true,
        deviceId: true,
        requestId: true,
        status: true,
        error: true,
        durationMs: true,
        metadata: true,
        hash: true,
        prevHash: true,
        createdAt: true,
      },
    });

    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

    for (const log of logs) {
      const { hash, prevHash: storedPrevHash, ...entryData } = log;

      const expectedPrevHash = storedPrevHash || prevHash;

      const canonical = this.canonicalize({
        tenantId: entryData.tenantId || undefined,
        userId: entryData.userId || undefined,
        sessionId: entryData.sessionId || undefined,
        action: entryData.action,
        resource: entryData.resource,
        resourceId: entryData.resourceId || undefined,
        before: entryData.before,
        after: entryData.after,
        ipAddress: entryData.ipAddress || undefined,
        userAgent: entryData.userAgent || undefined,
        deviceId: entryData.deviceId || undefined,
        requestId: entryData.requestId || undefined,
        status: entryData.status as any,
        error: entryData.error || undefined,
        durationMs: entryData.durationMs || undefined,
        metadata: entryData.metadata as any,
      });

      const expectedHash = createHash("sha256")
        .update(canonical + expectedPrevHash)
        .digest("hex");

      if (expectedHash !== hash) {
        return {
          valid: false,
          checkedCount: logs.indexOf(log),
          firstInvalidId: log.id,
          firstInvalidAt: log.createdAt,
        };
      }

      prevHash = hash;
    }

    return { valid: true, checkedCount: logs.length };
  }

  private async getLastHash(tenantId?: string): Promise<string> {
    if (this.lastHashCache) return this.lastHashCache;

    const last = await basePrisma.auditLog.findFirst({
      where: tenantId ? { tenantId } : {},
      orderBy: { createdAt: "desc" },
      select: { hash: true },
    });

    return last?.hash || "0000000000000000000000000000000000000000000000000000000000000000";
  }

  private canonicalize(entry: Omit<AuditLogEntry, "durationMs"> & { durationMs?: number }): string {
    return JSON.stringify({
      tenantId: entry.tenantId || null,
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId || null,
      before: entry.before || null,
      after: entry.after || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      deviceId: entry.deviceId || null,
      requestId: entry.requestId || null,
      status: entry.status || "SUCCESS",
      error: entry.error || null,
    });
  }
}
