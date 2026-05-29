/**
 * @shram-sewa/shared — Shared business logic package
 *
 * Exports:
 * - Types: TypeScript interfaces for the domain model
 * - Validation: Zod schemas for input validation
 * - API: Supabase client and API helpers
 * - Constants: Nepal geodata and job categories
 */

export const platformName = "Shram Sewa";
export const platformNameNp = "श्रम सेवा";

// Types
export * from "./types";

// Validation schemas
export * from "./validation";

// API client
export * from "./api";

// Constants
export * from "./constants";
