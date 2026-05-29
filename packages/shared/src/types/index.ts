/**
 * Core TypeScript interfaces for Shram Sewa
 * Based on AGENTS.md Section 6 — Database Schema
 */

// ═══════════════════════════════════════════════════════════════════════════════
// USER & AUTH TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type UserRole = "worker" | "hirer" | "admin";

export interface User {
  id: string;
  phone: string;
  fullName: string;
  fullNameNp?: string;
  role: UserRole;
  isVerified: boolean;
  isActive: boolean;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEODATA TYPES (Nepal Administrative Structure)
// ═══════════════════════════════════════════════════════════════════════════════

export interface Province {
  id: number;
  nameEn: string;
  nameNp: string;
  colorHex?: string;
}

export interface District {
  id: number;
  provinceId: number;
  nameEn: string;
  nameNp?: string;
}

export type LocalUnitType =
  | "metropolitan"
  | "sub_metropolitan"
  | "municipality"
  | "rural_municipality";

export interface LocalUnit {
  id: number;
  districtId: number;
  nameEn: string;
  nameNp?: string;
  unitType: LocalUnitType;
  wardCount: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// JOB CATEGORY TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface JobCategory {
  id: number;
  slug: string;
  nameEn: string;
  nameNp: string;
  icon?: string;
  description?: string;
  isActive: boolean;
}

// Predefined job slugs for type safety
export type JobSlug =
  | "gardener"
  | "mason"
  | "plumber"
  | "electrician"
  | "carpenter"
  | "painter"
  | "soil_plougher"
  | "harvester"
  | "domestic_helper"
  | "construction_labor"
  | "welder"
  | "driver";

// ═══════════════════════════════════════════════════════════════════════════════
// WORKER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkerProfile {
  id: string;
  fullName: string;
  fullNameNp?: string;
  avatarUrl?: string;
  userId: string;
  jobCategoryId: number;
  jobCategoryNameNp?: string;
  jobCategoryNameEn?: string;
  provinceId: number;
  districtId: number;
  districtNameNp?: string;
  districtNameEn?: string;
  localUnitId: number;
  localUnitNameNp?: string;
  localUnitNameEn?: string;
  wardNo: number;

  // Status
  isAvailable: boolean;
  isApproved: boolean;
  approvalNote?: string;

  // Work details
  experienceYrs: number;
  about?: string;
  dailyRateNpr?: number;
  citizenshipNo?: string;

  // Denormalized stats
  totalHires: number;
  pendingHires: number;
  avgRating: number;
  totalReviews: number;

  createdAt: Date;
  updatedAt: Date;
}

// Extended worker with joined data for display
export interface WorkerDisplay extends WorkerProfile {
  user: Pick<User, "fullName" | "fullNameNp" | "phone" | "avatarUrl">;
  jobCategory: Pick<JobCategory, "nameEn" | "nameNp" | "icon">;
  province: Pick<Province, "nameEn" | "nameNp">;
  district: Pick<District, "nameEn" | "nameNp">;
  localUnit: Pick<LocalUnit, "nameEn" | "nameNp" | "unitType">;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HIRE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type HireStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "completed"
  | "cancelled";

export interface HireRecord {
  id: string;
  workerId: string;
  hirerId: string;

  // IP enforcement
  hirerIp: string;
  ipFingerprint?: string;

  // Status
  status: HireStatus;

  // Location context at time of hire
  hireProvinceId?: number;
  hireDistrictId?: number;
  hireLocalUnitId?: number;

  // Work details
  workDescription?: string;
  agreedRateNpr?: number;
  workDate?: Date;
  workDurationDays: number;

  // Timeline
  hiredAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Review
  rating?: number;
  reviewText?: string;
  reviewedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationType =
  | "hire_request"
  | "hire_accepted"
  | "hire_rejected"
  | "hire_completed"
  | "new_review"
  | "system";

export interface Notification {
  id: string;
  userId: string;
  hireId?: string;
  type: NotificationType;
  title: string;
  titleNp?: string;
  body: string;
  bodyNp?: string;
  isRead: boolean;
  pushSent: boolean;
  createdAt: Date;
}

export type PushPlatform = "android" | "ios" | "web";

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH & FILTER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkerSearchFilters {
  provinceId?: number;
  districtId?: number;
  localUnitId?: number;
  wardNo?: number;
  jobCategoryId?: number;
  isAvailable?: boolean;
  minRating?: number;
  maxDailyRate?: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
