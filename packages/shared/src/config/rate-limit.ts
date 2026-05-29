/**
 * Rate Limiting Configuration
 * Upstash Redis-based rate limiting for API endpoints
 */

/**
 * Rate limit configurations per endpoint type
 */
export const RATE_LIMITS = {
  // General API requests
  api: {
    requests: 100,
    window: 60, // 60 seconds = 1 minute
    message: "Too many requests. Please try again in a minute.",
  },

  // OTP requests (phone verification)
  otp_request: {
    requests: 3,
    window: 300, // 5 minutes
    message:
      "Too many OTP requests. Please wait 5 minutes before requesting again.",
  },

  // Login attempts
  login: {
    requests: 5,
    window: 900, // 15 minutes
    message: "Too many login attempts. Please wait 15 minutes.",
  },

  // Worker search queries
  search: {
    requests: 30,
    window: 60, // 1 minute
    message: "Too many search queries. Please slow down.",
  },

  // Hire requests (critical action)
  hire_request: {
    requests: 5,
    window: 3600, // 1 hour
    message:
      "You've made too many hire requests. Please wait before trying again.",
  },

  // Review submissions
  review: {
    requests: 10,
    window: 3600, // 1 hour
    message: "Too many reviews submitted. Please wait before submitting more.",
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Get rate limit configuration for an endpoint
 */
export function getRateLimit(type: RateLimitType) {
  return RATE_LIMITS[type];
}

/**
 * Generate Redis key for rate limiting
 * Format: ratelimit:{type}:{identifier}
 */
export function getRateLimitKey(
  type: RateLimitType,
  identifier: string,
): string {
  const normalized = identifier.trim().toLowerCase();
  return `ratelimit:${type}:${normalized}`;
}

/**
 * Calculate time until rate limit resets
 */
export function getResetTime(window: number): number {
  return Math.floor(Date.now() / 1000) + window;
}
