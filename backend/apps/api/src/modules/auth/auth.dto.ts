import { z } from "zod";

// ── Login ──────────────────────────────────────────────────────────────────
export const LoginDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  rememberMe: z.boolean().default(false),
});

// ── Register ───────────────────────────────────────────────────────────────
export const RegisterDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z.string().optional(),
  inviteToken: z.string().optional(),
});

// ── Refresh Token ──────────────────────────────────────────────────────────
export const RefreshTokenDto = z.object({
  refreshToken: z.string().min(1),
});

// ── Logout ────────────────────────────────────────────────────────────────
export const LogoutDto = z.object({
  refreshToken: z.string().optional(),
  allDevices: z.boolean().default(false),
});

// ── Forgot Password ────────────────────────────────────────────────────────
export const ForgotPasswordDto = z.object({
  email: z.string().email().toLowerCase().trim(),
});

// ── Reset Password ─────────────────────────────────────────────────────────
export const ResetPasswordDto = z.object({
  email: z.string().email().toLowerCase().trim(),
  token: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
});

// ── Change Password ────────────────────────────────────────────────────────
export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
});

// ── Verify Email ───────────────────────────────────────────────────────────
export const VerifyEmailDto = z.object({
  token: z.string().min(1),
});

// ── MFA Setup ─────────────────────────────────────────────────────────────
export const MfaVerifyDto = z.object({
  code: z.string().length(6).regex(/^\d+$/),
});

export const MfaLoginDto = z.object({
  mfaToken: z.string().min(1),
  code: z.string().length(6).regex(/^\d+$/),
});

// ── Types ──────────────────────────────────────────────────────────────────
export type LoginDtoType = z.infer<typeof LoginDto>;
export type RegisterDtoType = z.infer<typeof RegisterDto>;
export type RefreshTokenDtoType = z.infer<typeof RefreshTokenDto>;
export type LogoutDtoType = z.infer<typeof LogoutDto>;
export type ForgotPasswordDtoType = z.infer<typeof ForgotPasswordDto>;
export type ResetPasswordDtoType = z.infer<typeof ResetPasswordDto>;
export type ChangePasswordDtoType = z.infer<typeof ChangePasswordDto>;
export type MfaVerifyDtoType = z.infer<typeof MfaVerifyDto>;
export type MfaLoginDtoType = z.infer<typeof MfaLoginDto>;
