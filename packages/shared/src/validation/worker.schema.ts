/**
 * Worker Profile Validation Schemas
 * Zod schemas for worker-related inputs
 */

import { z } from "zod";
import { nepalPhoneSchema } from "./auth.schema";

/**
 * Nepal Citizenship Number Validation
 * Format: XX-XX-XX-XXXXX or XXXXXXXXXXXX (varies by issue date)
 * Relaxed validation for legacy formats
 */
export const citizenshipNumberSchema = z
  .string()
  .min(5)
  .max(20)
  .regex(/^[0-9-]+$/, {
    message: "Citizenship number can only contain digits and hyphens",
  })
  .transform((val) => val.trim());

/**
 * Name validation (English or Nepali)
 * Allows unicode characters for Devanagari script
 * Max 100 characters, min 2 characters
 */
export const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must not exceed 100 characters")
  .regex(/^[\p{L}\p{M}\s.'-]+$/u, {
    message: "Name contains invalid characters",
  })
  .transform((val) => val.trim());

/**
 * About/Bio text validation
 * Max 500 characters
 */
export const aboutSchema = z
  .string()
  .max(500, "Bio must not exceed 500 characters")
  .optional()
  .transform((val) => val?.trim());

/**
 * Daily rate validation (NPR)
 * Minimum 500 NPR, Maximum 10,000 NPR
 */
export const dailyRateSchema = z
  .number()
  .int("Daily rate must be a whole number")
  .min(500, "Daily rate must be at least NPR 500")
  .max(10000, "Daily rate must not exceed NPR 10,000");

/**
 * Experience years validation
 * 0-50 years
 */
export const experienceYearsSchema = z
  .number()
  .int()
  .min(0, "Experience cannot be negative")
  .max(50, "Experience cannot exceed 50 years");

/**
 * Ward number validation
 * Nepal local units have 1-35 wards (most have 9-15)
 */
export const wardNumberSchema = z
  .number()
  .int()
  .min(1, "Ward number must be at least 1")
  .max(35, "Ward number cannot exceed 35");

/**
 * Worker Profile Creation Schema
 */
export const createWorkerProfileSchema = z.object({
  userId: z.string().uuid(),
  jobCategoryId: z.number().int().positive(),
  provinceId: z.number().int().min(1).max(7),
  districtId: z.number().int().min(1).max(77),
  localUnitId: z.number().int().positive(),
  wardNo: wardNumberSchema,
  fullName: nameSchema,
  fullNameNp: nameSchema.optional(),
  experienceYrs: experienceYearsSchema.default(0),
  about: aboutSchema,
  dailyRateNpr: dailyRateSchema,
  citizenshipNo: citizenshipNumberSchema.optional(),
});

export type CreateWorkerProfile = z.infer<typeof createWorkerProfileSchema>;

/**
 * Worker Profile Update Schema (all fields optional)
 */
export const updateWorkerProfileSchema = createWorkerProfileSchema
  .partial()
  .omit({ userId: true }); // Can't change userId

export type UpdateWorkerProfile = z.infer<typeof updateWorkerProfileSchema>;

/**
 * Worker Search Filters Schema
 */
export const workerSearchSchema = z.object({
  provinceId: z.number().int().min(1).max(7).optional(),
  districtId: z.number().int().min(1).max(77).optional(),
  localUnitId: z.number().int().positive().optional(),
  jobCategoryId: z.number().int().positive().optional(),
  minRate: dailyRateSchema.optional(),
  maxRate: dailyRateSchema.optional(),
  minExperience: experienceYearsSchema.optional(),
  isAvailable: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type WorkerSearchFilters = z.infer<typeof workerSearchSchema>;
