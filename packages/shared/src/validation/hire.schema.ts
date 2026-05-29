/**
 * Hire Record Validation Schemas
 * Zod schemas for hire-related inputs
 */

import { z } from "zod";

/**
 * Work description validation
 * Min 10 chars, Max 500 chars
 */
export const workDescriptionSchema = z
  .string()
  .min(10, "Work description must be at least 10 characters")
  .max(500, "Work description must not exceed 500 characters")
  .transform((val) => val.trim());

/**
 * Work date validation
 * Must be today or in the future
 */
export const workDateSchema = z
  .string()
  .date("Invalid date format")
  .refine(
    (dateStr) => {
      const workDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return workDate >= today;
    },
    { message: "Work date cannot be in the past" }
  );

/**
 * Work duration validation
 * 1-90 days
 */
export const workDurationSchema = z
  .number()
  .int()
  .min(1, "Work duration must be at least 1 day")
  .max(90, "Work duration cannot exceed 90 days");

/**
 * Agreed rate validation (same as daily rate)
 */
export const agreedRateSchema = z
  .number()
  .int("Agreed rate must be a whole number")
  .min(500, "Agreed rate must be at least NPR 500")
  .max(10000, "Agreed rate must not exceed NPR 10,000");

/**
 * Rating validation
 * 1-5 stars
 */
export const ratingSchema = z
  .number()
  .int()
  .min(1, "Rating must be at least 1 star")
  .max(5, "Rating must not exceed 5 stars");

/**
 * Review text validation
 * Optional, max 300 chars
 */
export const reviewTextSchema = z
  .string()
  .max(300, "Review must not exceed 300 characters")
  .optional()
  .transform((val) => val?.trim());

/**
 * IP Address validation
 * IPv4 or IPv6
 */
export const ipAddressSchema = z.string().ip();

/**
 * Create Hire Request Schema
 *
 * Notes on optionality:
 * - hirerId: omitted in browser flow because the edge function derives it
 *   from the auth context (server is the source of truth).
 * - hirerIp: optional in the browser flow — when missing, the API forwards
 *   to the `hire-worker` edge function which captures the IP from request
 *   headers. When set, the API may insert directly with the client-supplied
 *   IP (used for retries from the offline outbox).
 * - agreedRateNpr: optional. The hire form labels it "Optional"; when
 *   absent, hirer and worker negotiate the rate offline.
 */
export const createHireRequestSchema = z.object({
  workerId: z.string().uuid(),
  hirerId: z.string().uuid().optional(),
  workDescription: workDescriptionSchema,
  workDate: workDateSchema,
  workDurationDays: workDurationSchema,
  agreedRateNpr: agreedRateSchema.optional(),
  hirerIp: ipAddressSchema.optional(),
  ipFingerprint: z.string().optional(), // Browser fingerprint
  hireProvinceId: z.number().int().min(1).max(7).optional(),
  hireDistrictId: z.number().int().min(1).max(77).optional(),
  hireLocalUnitId: z.number().int().positive().optional(),
});

export type CreateHireRequest = z.infer<typeof createHireRequestSchema>;

/**
 * Update Hire Status Schema
 */
export const updateHireStatusSchema = z.object({
  hireId: z.string().uuid(),
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "completed",
    "cancelled",
  ]),
  cancellationReason: z.string().max(200).optional(),
});

export type UpdateHireStatus = z.infer<typeof updateHireStatusSchema>;

/**
 * Submit Review Schema
 */
export const submitReviewSchema = z.object({
  hireId: z.string().uuid(),
  rating: ratingSchema,
  reviewText: reviewTextSchema,
});

export type SubmitReview = z.infer<typeof submitReviewSchema>;

/**
 * Hire Record Query Schema
 */
export const hireRecordQuerySchema = z.object({
  workerId: z.string().uuid().optional(),
  hirerId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "accepted", "rejected", "completed", "cancelled"])
    .optional(),
  fromDate: z.string().date().optional(),
  toDate: z.string().date().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

export type HireRecordQuery = z.infer<typeof hireRecordQuerySchema>;
