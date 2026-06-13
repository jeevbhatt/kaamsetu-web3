import { getSupabase } from "./client";

export const authApi = {
  /**
   * Request OTP for phone login
   */
  async requestOtp(phone: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
    });
    if (error) throw error;
    return { success: true };
  },

  /**
   * Email magic-link fallback for when SMS OTP can't be received.
   * Sends a one-click sign-in link to the email (no password). Used as the
   * last resort after Sparrow → Twilio both fail to deliver the SMS code.
   */
  async requestEmailMagicLink(email: string, redirectTo?: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw error;
    return { success: true };
  },

  /**
   * Verify OTP and complete login
   */
  async verifyOtp(phone: string, token: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Register a new account with email + password. Returns { session, user }.
   * If email confirmation is enabled in Supabase, `session` will be null and
   * the caller should tell the user to confirm via the email link.
   */
  async signUpWithPassword(
    email: string,
    password: string,
    redirectTo?: string,
  ) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Send a password-reset email. The link lands on `redirectTo` where the
   * user can set a new password.
   */
  async resetPassword(email: string, redirectTo?: string) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    if (error) throw error;
    return { success: true };
  },

  /**
   * Set a new password for the currently-authenticated user. Used on the
   * password-reset landing page, where the recovery link has already
   * established a (recovery) session for the user.
   */
  async updatePassword(newPassword: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  async getSession() {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    const supabase = getSupabase();
    return supabase.auth.onAuthStateChange(callback);
  },

  /**
   * Update user metadata
   */
  async updateUser(attributes: { data: Record<string, unknown> }) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.updateUser(attributes);
    if (error) throw error;
    return data;
  },
};
