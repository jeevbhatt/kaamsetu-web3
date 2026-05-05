/**
 * Auth Store — Zustand
 * Manages authentication state across the web app
 */

import { create } from "zustand";
import type { User, AuthSession } from "@shram-sewa/shared";
import { authApi } from "@shram-sewa/shared";
import { getSupabaseClient, isSupabaseConfigured } from "../lib";

type SupabaseSessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | null;
  user?: {
    id?: string;
    phone?: string | null;
    phone_confirmed_at?: string | null;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
};

function mapSupabaseSession(raw: unknown): AuthSession | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const session = raw as SupabaseSessionLike;
  if (
    typeof session.access_token !== "string" ||
    !session.user ||
    typeof session.user.id !== "string"
  ) {
    return null;
  }

  const metadata = session.user.user_metadata ?? {};
  const now = new Date();
  const role =
    metadata.role === "worker" ||
    metadata.role === "hirer" ||
    metadata.role === "admin"
      ? metadata.role
      : "hirer";

  return {
    accessToken: session.access_token,
    refreshToken:
      typeof session.refresh_token === "string" ? session.refresh_token : "",
    expiresAt: typeof session.expires_at === "number" ? session.expires_at : 0,
    user: {
      id: session.user.id,
      phone:
        typeof session.user.phone === "string"
          ? session.user.phone.replace("+977", "")
          : "",
      fullName:
        typeof metadata.full_name === "string" ? metadata.full_name : "",
      fullNameNp:
        typeof metadata.full_name_np === "string"
          ? metadata.full_name_np
          : undefined,
      role,
      isVerified: Boolean(
        session.user.phone_confirmed_at || session.user.email_confirmed_at,
      ),
      isActive: true,
      avatarUrl:
        typeof metadata.avatar_url === "string"
          ? metadata.avatar_url
          : undefined,
      createdAt: now,
      updatedAt: now,
    },
  };
}

let authListenerBound = false;

// Auth helper functions using authApi
async function requestPhoneOtp(params: { phone: string; locale: string }) {
  try {
    await authApi.requestOtp(`+977${params.phone}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function verifyOtp(params: {
  phone: string;
  otp: string;
}): Promise<{ session: AuthSession | null; error?: string }> {
  try {
    const result = await authApi.verifyOtp(`+977${params.phone}`, params.otp);
    const session = mapSupabaseSession(result.session);

    if (!session) {
      return { session: null, error: "No session returned" };
    }

    return { session };
  } catch (error) {
    return {
      session: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function signInWithEmailPassword(params: {
  email: string;
  password: string;
}): Promise<{ session: AuthSession | null; error?: string }> {
  try {
    const result = await authApi.signInWithPassword(
      params.email,
      params.password,
    );
    const session = mapSupabaseSession(result.session);

    if (!session) {
      return { session: null, error: "No session returned" };
    }

    return { session };
  } catch (error) {
    return {
      session: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

interface AuthState {
  // State
  user: User | null;
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authError: string | null;

  // Actions
  setSession: (session: AuthSession | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => Promise<void>;
  login: (phone: string, otp?: string) => Promise<boolean>;
  loginWithEmail: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isProfileComplete: () => boolean;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  // Initial state
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  authError: null,

  // Actions
  isProfileComplete: () => {
    const { user } = get();
    if (!user) return false;
    // Check if the user has basic details set (like full name)
    // If it's a worker, they should also have a job category, but for now we just check fullName as the minimum threshold for both roles.
    return Boolean(user.fullName && user.fullName.trim() !== "");
  },
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
      isLoading: false,
      authError: null,
    }),

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  setLoading: (isLoading) => set({ isLoading }),

  initialize: async () => {
    set({ isLoading: true });

    if (!isSupabaseConfigured()) {
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        authError: "OTP login is currently unavailable.",
      });
      return;
    }

    try {
      // Ensure client is initialized before session and subscription checks.
      getSupabaseClient();

      const liveSession = mapSupabaseSession(await authApi.getSession());
      set({
        session: liveSession,
        user: liveSession?.user ?? null,
        isAuthenticated: !!liveSession,
        isLoading: false,
        authError: null,
      });

      if (!authListenerBound) {
        authApi.onAuthStateChange((_event, session) => {
          const nextSession = mapSupabaseSession(session);
          set({
            session: nextSession,
            user: nextSession?.user ?? null,
            isAuthenticated: !!nextSession,
            isLoading: false,
            authError: null,
          });
        });
        authListenerBound = true;
      }
    } catch (error) {
      console.error("Auth initialization failed:", error);
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        authError: "Authentication service is unavailable.",
      });
    }
  },

  login: async (phone: string, otp?: string) => {
    set({ isLoading: true });
    try {
      if (!isSupabaseConfigured()) {
        set({
          isLoading: false,
          authError: "OTP login is currently unavailable.",
        });
        return false;
      }

      // Initialize shared Supabase client once per session.
      getSupabaseClient();

      // Step 1: Request OTP if not provided
      if (!otp) {
        const { success, error } = await requestPhoneOtp({
          phone,
          locale: "en",
        });
        if (!success) {
          console.error("OTP request failed:", error);
          set({
            isLoading: false,
            authError: error ?? "Failed to send OTP. Please try again.",
          });
          return false;
        }
        // OTP sent successfully - waiting for user to enter it
        set({ isLoading: false, authError: null });
        return true;
      }

      // Step 2: Verify OTP and create session
      const { session, error } = await verifyOtp({ phone, otp });
      if (error || !session) {
        console.error("OTP verification failed:", error);
        set({
          isLoading: false,
          authError: error ?? "OTP verification failed. Please try again.",
        });
        return false;
      }

      set({
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });
      return true;
    } catch (err) {
      console.error("Login error:", err);
      set({
        isLoading: false,
        authError:
          err instanceof Error
            ? err.message
            : "Login failed. Please try again.",
      });
      return false;
    }
  },

  loginWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      if (!isSupabaseConfigured()) {
        set({
          isLoading: false,
          authError: "Login is currently unavailable.",
        });
        return false;
      }

      getSupabaseClient();

      const { session, error } = await signInWithEmailPassword({
        email,
        password,
      });
      if (error || !session) {
        set({
          isLoading: false,
          authError: error ?? "Email login failed. Please try again.",
        });
        return false;
      }

      set({
        user: session.user,
        session,
        isAuthenticated: true,
        isLoading: false,
        authError: null,
      });
      return true;
    } catch (err) {
      set({
        isLoading: false,
        authError:
          err instanceof Error
            ? err.message
            : "Login failed. Please try again.",
      });
      return false;
    }
  },

  logout: async () => {
    if (isSupabaseConfigured()) {
      try {
        getSupabaseClient();
        await authApi.signOut();
      } catch (error) {
        console.error("Logout failed:", error);
      }
    }

    set({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
    });
  },
}));
