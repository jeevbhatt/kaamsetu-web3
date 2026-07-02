/**
 * useAuth — thin wrapper over useAuthStore (Zustand).
 *
 * MIGRATION NOTE: The previous version had a separate React Context that
 * was not connected to useAuthStore, causing components to see stale auth
 * state. This version proxies directly to the single source of truth
 * (useAuthStore) so all auth consumers stay in sync.
 */
import { useAuthStore } from "../store/auth-store";
import { getSupabaseSafe } from "../lib/supabase";
import { getAuthRedirectUrl } from "../lib/auth-redirect";

// Re-export the store hook as useAuth for backwards compatibility
export function useAuth() {
  const {
    user,
    session,
    isLoading,
    isAuthenticated,
    authError,
    login,
    loginWithEmail,
    logout,
    isProfileComplete,
  } = useAuthStore();

  /**
   * Legacy signInWithOtp  — kept for any component that used the old Context.
   * Delegates to useAuthStore.login which handles the two-step OTP flow.
   */
  const signInWithOtp = async (phone: string) => {
    const sent = await login(phone);
    return sent ? { success: true } : { success: false, error: useAuthStore.getState().authError ?? "Failed to send OTP" };
  };

  /**
   * Legacy verifyOtp — step 2 of phone OTP flow.
   */
  const verifyOtp = async (phone: string, token: string) => {
    const ok = await login(phone, token);
    return ok ? { success: true } : { success: false, error: useAuthStore.getState().authError ?? "OTP verification failed" };
  };

  /**
   * Legacy signInWithPassword — email + password.
   */
  const signInWithPassword = async (email: string, password: string) => {
    const ok = await loginWithEmail(email, password);
    return ok ? { success: true } : { success: false, error: useAuthStore.getState().authError ?? "Login failed" };
  };

  /**
   * Legacy signUp — wraps Supabase directly (not in store, but delegates to it).
   */
  const signUp = async (email: string, password: string, meta?: Record<string, unknown>) => {
    const supabase = getSupabaseSafe();
    if (!supabase) return { success: false, error: "Supabase not available" };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: meta,
        emailRedirectTo: getAuthRedirectUrl("/profile"),
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  return {
    // State
    user,
    session,
    isLoading,
    isAuthenticated,
    authError,
    // Actions (new API)
    login,
    loginWithEmail,
    logout,
    isProfileComplete,
    // Legacy API kept for backwards compatibility
    signInWithOtp,
    verifyOtp,
    signInWithPassword,
    signUp,
    signOut: logout,
    // Modal state kept as no-op stubs (was in old Context, no longer needed)
    showAuthModal: false,
    setShowAuthModal: (_v: boolean) => { /* no-op — modals now use useUIStore */ },
  };
}

/**
 * AuthProvider is no longer needed (Zustand is global).
 * Kept as a passthrough for any legacy usage in JSX.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
