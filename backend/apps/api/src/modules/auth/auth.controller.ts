import type { FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "./auth.service";
import {
  LoginDto, RefreshTokenDto, LogoutDto, ForgotPasswordDto,
  ResetPasswordDto, ChangePasswordDto, MfaVerifyDto, MfaLoginDto,
} from "./auth.dto";
import type { LoginDtoType } from "./auth.dto";
import { ValidationError } from "../../shared/errors/http.errors";
import { AuditLogService } from "../audit-logs/audit-log.service";

const authService = new AuthService();
const auditLog = new AuditLogService();

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = LoginDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const tenantId = (request as any).tenantId;
    const result = await authService.login(tenantId, body.data, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    if ("requiresMfa" in result) {
      return reply.status(200).send({
        success: true,
        data: { requiresMfa: true, mfaToken: result.mfaToken },
      });
    }

    await auditLog.log({
      tenantId,
      userId: result.user.id,
      sessionId: result.sessionId,
      action: "LOGIN",
      resource: "auth",
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      status: "SUCCESS",
    });

    return reply.status(200).send({ success: true, data: result });
  }

  async mfaLogin(request: FastifyRequest, reply: FastifyReply) {
    const body = MfaLoginDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const result = await authService.completeMfaLogin(body.data, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return reply.status(200).send({ success: true, data: result });
  }

  async refreshToken(request: FastifyRequest, reply: FastifyReply) {
    const body = RefreshTokenDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const tokens = await authService.refreshTokens(body.data.refreshToken, {
      ipAddress: request.ip,
    });

    return reply.status(200).send({ success: true, data: tokens });
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const body = LogoutDto.safeParse(request.body || {});
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const req = request as any;
    await authService.logout(req.userId, req.sessionId, body.data.refreshToken, body.data.allDevices);

    await auditLog.log({
      tenantId: req.tenantId,
      userId: req.userId,
      sessionId: req.sessionId,
      action: "LOGOUT",
      resource: "auth",
      ipAddress: request.ip,
      status: "SUCCESS",
    });

    return reply.status(200).send({ success: true, message: "Logged out successfully" });
  }

  async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = ForgotPasswordDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const tenantId = (request as any).tenantId;
    await authService.forgotPassword(tenantId, body.data.email);

    return reply.status(200).send({
      success: true,
      message: "If the email exists, a reset code has been sent",
    });
  }

  async resetPassword(request: FastifyRequest, reply: FastifyReply) {
    const body = ResetPasswordDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const tenantId = (request as any).tenantId;
    await authService.resetPassword(tenantId, body.data.email, body.data.token, body.data.newPassword);

    return reply.status(200).send({ success: true, message: "Password reset successfully" });
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const body = ChangePasswordDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const req = request as any;
    await authService.changePassword(req.userId, body.data.currentPassword, body.data.newPassword);

    return reply.status(200).send({ success: true, message: "Password changed successfully" });
  }

  async setupMfa(request: FastifyRequest, reply: FastifyReply) {
    const req = request as any;
    const result = await authService.setupMfa(req.userId);
    return reply.status(200).send({ success: true, data: result });
  }

  async confirmMfa(request: FastifyRequest, reply: FastifyReply) {
    const body = MfaVerifyDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const req = request as any;
    await authService.confirmMfa(req.userId, body.data.code);

    return reply.status(200).send({ success: true, message: "MFA enabled successfully" });
  }

  async disableMfa(request: FastifyRequest, reply: FastifyReply) {
    const body = MfaVerifyDto.safeParse(request.body);
    if (!body.success) throw new ValidationError("Invalid input", body.error.errors);

    const req = request as any;
    await authService.disableMfa(req.userId, body.data.code);

    return reply.status(200).send({ success: true, message: "MFA disabled successfully" });
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    return reply.status(200).send({
      success: true,
      data: {
        userId: (request as any).userId,
        tenantId: (request as any).tenantId,
        roles: (request as any).roles,
        permissions: (request as any).permissions,
      },
    });
  }
}
