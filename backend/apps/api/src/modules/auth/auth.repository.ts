import { basePrisma } from "@360crd/database";
import type { User, RefreshToken, OTPType } from "@prisma/client";
import { randomUUID } from "crypto";
import { createHash } from "crypto";

export class AuthRepository {
  async findUserByEmail(tenantId: string, email: string) {
    return basePrisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  async findUserById(userId: string) {
    return basePrisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  async updateLoginSuccess(userId: string, ipAddress?: string) {
    return basePrisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async incrementFailedAttempts(userId: string, maxAttempts: number) {
    const user = await basePrisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
    });

    if (user.failedLoginAttempts >= maxAttempts) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
      await basePrisma.user.update({
        where: { id: userId },
        data: { lockedUntil: lockUntil },
      });
      return lockUntil;
    }

    return null;
  }

  async createSession(data: {
    userId: string;
    tenantId: string;
    deviceId?: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return basePrisma.session.create({ data });
  }

  async invalidateSession(sessionId: string) {
    return basePrisma.session.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  async invalidateAllSessions(userId: string) {
    return basePrisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  async createRefreshToken(data: {
    userId: string;
    tenantId: string;
    token: string;
    family: string;
    deviceId?: string;
    ipAddress?: string;
    expiresAt: Date;
  }) {
    const tokenHash = createHash("sha256").update(data.token).digest("hex");
    return basePrisma.refreshToken.create({
      data: {
        userId: data.userId,
        tenantId: data.tenantId,
        tokenHash,
        family: data.family,
        deviceId: data.deviceId,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findRefreshToken(token: string) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    return basePrisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revokeRefreshToken(id: string) {
    return basePrisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeTokenFamily(family: string) {
    return basePrisma.refreshToken.updateMany({
      where: { family, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async revokeAllUserTokens(userId: string) {
    return basePrisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  async createOTP(data: {
    userId: string;
    code: string;
    type: OTPType;
    expiresAt: Date;
    ipAddress?: string;
  }) {
    // Invalidate existing OTPs of same type
    await basePrisma.oTPCode.updateMany({
      where: { userId: data.userId, type: data.type, isUsed: false },
      data: { isUsed: true },
    });

    return basePrisma.oTPCode.create({ data });
  }

  async validateOTP(userId: string, code: string, type: OTPType) {
    const otp = await basePrisma.oTPCode.findFirst({
      where: {
        userId,
        code,
        type,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otp) return null;

    await basePrisma.oTPCode.update({
      where: { id: otp.id },
      data: { isUsed: true, usedAt: new Date() },
    });

    return otp;
  }

  async upsertDevice(data: {
    userId: string;
    tenantId: string;
    deviceId: string;
    deviceName?: string;
    deviceType?: string;
    platform?: string;
    pushToken?: string;
  }) {
    return basePrisma.userDevice.upsert({
      where: { deviceId: data.deviceId },
      update: {
        deviceName: data.deviceName,
        pushToken: data.pushToken,
        lastSeenAt: new Date(),
        isActive: true,
      },
      create: {
        ...data,
        lastSeenAt: new Date(),
      },
    });
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    return basePrisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });
  }

  async verifyEmail(userId: string) {
    return basePrisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    });
  }

  async updateMfaSecret(userId: string, secret: string | null) {
    return basePrisma.user.update({
      where: { id: userId },
      data: {
        mfaSecret: secret,
        mfaEnabled: secret !== null,
      },
    });
  }
}
