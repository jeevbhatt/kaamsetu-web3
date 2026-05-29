/**
 * Authentication Validation Schemas
 * Zod schemas for all auth-related inputs
 */

import { z } from "zod";

/**
 * Nepal phone number validation
 * Format: 98XXXXXXXX (10 digits starting with 98)
 * Examples: 9841234567, 9801234567
 */
export const nepalPhoneSchema = z
  .string()
  .regex(/^98[0-9]{8}$/, {
    message: "Phone number must be 10 digits starting with 98",
  })
  .transform((val) => val.trim());

/**
 * OTP validation
 * 6-digit numeric code
 */
export const otpSchema = z
  .string()
  .regex(/^[0-9]{6}$/, {
    message: "OTP must be 6 digits",
  })
  .length(6);

/**
 * JWT token validation
 * Basic structure check for Bearer tokens
 */
export const jwtTokenSchema = z
  .string()
  .min(20)
  .regex(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/, {
    message: "Invalid JWT token format",
  });

/**
 * Phone OTP Request Schema
 */
export const phoneOtpRequestSchema = z.object({
  phone: nepalPhoneSchema,
  locale: z.enum(["en", "ne"]).default("en"),
});

export type PhoneOtpRequest = z.infer<typeof phoneOtpRequestSchema>;

/**
 * OTP Verification Schema
 */
export const otpVerificationSchema = z.object({
  phone: nepalPhoneSchema,
  otp: otpSchema,
});

export type OtpVerification = z.infer<typeof otpVerificationSchema>;

/**
 * Auth Session Schema
 */
export const authSessionSchema = z.object({
  accessToken: jwtTokenSchema,
  refreshToken: jwtTokenSchema,
  expiresAt: z.number(), // Unix timestamp
  expiresIn: z.number(), // Seconds until expiry
  user: z.object({
    id: z.string().uuid(),
    phone: nepalPhoneSchema,
    role: z.enum(["worker", "hirer", "admin"]),
    isVerified: z.boolean(),
  }),
});

export type AuthSession = z.infer<typeof authSessionSchema>;

/**
 * Refresh Token Request Schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: jwtTokenSchema,
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;
