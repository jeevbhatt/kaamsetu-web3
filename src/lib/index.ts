/**
 * Lib barrel export
 */

export { getSupabaseClient, isSupabaseConfigured } from "./supabase";
export { queryClient, queryKeys } from "./query-client";
export {
  resolveClientIpAddress,
  createIpFingerprint,
  hasHireIpLock,
  setHireIpLock,
} from "./security";
export { translateError } from "./error-messages";
export type { TranslateOptions } from "./error-messages";
export { getAuthRedirectUrl, getPublicWebOrigin } from "./auth-redirect";
