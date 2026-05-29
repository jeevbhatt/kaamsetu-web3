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
