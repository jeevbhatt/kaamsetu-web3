/**
 * Zod validation schemas for Shram Sewa
 * Shared between web, android, and edge functions
 */

import { z } from "zod";
import { districts, provinces } from "../constants";

const provinceIdSet = new Set(provinces.map((province) => province.id));
const districtIdSet = new Set(districts.map((district) => district.id));
const districtToProvinceMap = new Map(
  districts.map((district) => [district.id, district.provinceId]),
);

const provinceIdSchema = z
  .number()
  .int()
  .refine((value) => provinceIdSet.has(value), "Invalid province ID");

const districtIdSchema = z
  .number()
  .int()
  .refine((value) => districtIdSet.has(value), "Invalid district ID");

// ═══════════════════════════════════════════════════════════════════════════════
// COMMON VALIDATORS
// ═══════════════════════════════════════════════════════════════════════════════

// Nepal phone number: 98XXXXXXXX or 97XXXXXXXX (10 digits)
export const phoneSchema = z
  .string()
  .regex(
    /^9[78]\d{8}$/,
    "Invalid Nepal phone number (must be 98/97 + 8 digits)",
  );

// OTP: 6 digits
export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

// Ward number: 1-35 (max wards in Nepal municipalities)
export const wardSchema = z
  .number()
  .int()
  .min(1, "Ward must be at least 1")
  .max(35, "Ward cannot exceed 35");

// Rating: 1-5 stars
export const ratingSchema = z
  .number()
  .int()
  .min(1, "Rating must be at least 1")
  .max(5, "Rating cannot exceed 5");

// Daily rate in NPR (Nepal Rupees)
export const dailyRateSchema = z
  .number()
  .int()
  .min(500, "Minimum daily rate is NPR 500")
  .max(100000, "Maximum daily rate is NPR 100,000");

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const requestOtpSchema = z.object({
  phone: phoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: otpSchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

// ═══════════════════════════════════════════════════════════════════════════════
// USER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const userRoleSchema = z.enum(["worker", "hirer", "admin"]);

export const updateUserSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100)
    .optional(),
  fullNameNp: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER PROFILE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const localUnitTypeSchema = z.enum([
  "metropolitan",
  "sub_metropolitan",
  "municipality",
  "rural_municipality",
]);

const workerProfileSchemaBase = z.object({
  jobCategoryId: z.number().int().positive(),
  provinceId: provinceIdSchema,
  districtId: districtIdSchema,
  localUnitId: z.number().int().positive(),
  wardNo: wardSchema,
  experienceYrs: z.number().int().min(0).max(50).default(0),
  about: z.string().max(500).optional(),
  dailyRateNpr: dailyRateSchema.optional(),
  citizenshipNo: z.string().max(30).optional(),
});

export const createWorkerProfileSchema = workerProfileSchemaBase.superRefine(
  (value, ctx) => {
    const expectedProvinceId = districtToProvinceMap.get(value.districtId);
    if (!expectedProvinceId || expectedProvinceId !== value.provinceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["districtId"],
        message: "District does not belong to the selected province",
      });
    }
  },
);

export const updateWorkerProfileSchema = workerProfileSchemaBase
  .partial()
  .extend({
    isAvailable: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.provinceId || !value.districtId) {
      return;
    }

    const expectedProvinceId = districtToProvinceMap.get(value.districtId);
    if (!expectedProvinceId || expectedProvinceId !== value.provinceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["districtId"],
        message: "District does not belong to the selected province",
      });
    }
  });

export const workerSearchFiltersSchema = z
  .object({
    provinceId: provinceIdSchema.optional(),
    districtId: districtIdSchema.optional(),
    localUnitId: z.number().int().positive().optional(),
    wardNo: wardSchema.optional(),
    jobCategoryId: z.number().int().positive().optional(),
    isAvailable: z.boolean().optional(),
    minRating: z.number().min(1).max(5).optional(),
    maxDailyRate: z.number().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.provinceId || !value.districtId) {
      return;
    }

    const expectedProvinceId = districtToProvinceMap.get(value.districtId);
    if (!expectedProvinceId || expectedProvinceId !== value.provinceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["districtId"],
        message: "District does not belong to the selected province",
      });
    }
  });

// ═══════════════════════════════════════════════════════════════════════════════
// HIRE SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

export const hireStatusSchema = z.enum([
  "pending",
  "accepted",
  "rejected",
  "completed",
  "cancelled",
]);

export const createHireRequestSchema = z
  .object({
    workerId: z.string().uuid("Invalid worker ID"),
    hirerIp: z.string().min(7).max(45).optional(),
    ipFingerprint: z.string().min(8).max(128).optional(),
    workDescription: z.string().max(500).optional(),
    agreedRateNpr: dailyRateSchema.optional(),
    workDate: z.coerce.date().optional(),
    workDurationDays: z.number().int().min(1).max(365).default(1),
    hireProvinceId: provinceIdSchema.optional(),
    hireDistrictId: districtIdSchema.optional(),
    hireLocalUnitId: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.hireProvinceId || !value.hireDistrictId) {
      return;
    }

    const expectedProvinceId = districtToProvinceMap.get(value.hireDistrictId);
    if (!expectedProvinceId || expectedProvinceId !== value.hireProvinceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hireDistrictId"],
        message: "Hire district does not belong to the selected province",
      });
    }
  });

export const updateHireStatusSchema = z.object({
  hireId: z.string().uuid("Invalid hire ID"),
  status: hireStatusSchema,
});

export const submitReviewSchema = z.object({
  hireId: z.string().uuid("Invalid hire ID"),
  rating: ratingSchema,
  reviewText: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGINATION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT INFERRED TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateWorkerProfileInput = z.infer<
  typeof createWorkerProfileSchema
>;
export type UpdateWorkerProfileInput = z.infer<
  typeof updateWorkerProfileSchema
>;
export type WorkerSearchFiltersInput = z.infer<
  typeof workerSearchFiltersSchema
>;
export type CreateHireRequestInput = z.infer<typeof createHireRequestSchema>;
export type UpdateHireStatusInput = z.infer<typeof updateHireStatusSchema>;
export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
