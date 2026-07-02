/**
 * Auth Store — Zustand
 * Manages authentication state across the web app
 */

import { create } from "zustand";
import type { User, AuthSession } from "@shram-sewa/shared";
import { authApi } from "@shram-sewa/shared";
import { getSupabaseClient, isSupabaseConfigured } from "../lib";
import { setUserContext } from "../lib/sentry";
import { clearQueryCaches } from "../lib/query-client";

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
const AUTH_SESSION_TIMEOUT_MS = 4000;

// public.users is the source of truth for role/profile fields. The session's
// user_metadata can lag behind it (e.g. seeded admins, role switches from
// another device), which previously made an admin render the hirer dashboard
// and hid the phone saved via the profile form. After sign-in we fetch the DB
// row and merge it over the session-derived user.
let hydratedUserId: string | null = null;

async function fetchDbUser(userId: string): Promise<Partial<User> | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select(
        "phone, full_name, full_name_np, role, is_verified, is_active, avatar_url",
      )
      .eq("id", userId)
      .maybeSingle<{
        phone: string | null;
        full_name: string | null;
        full_name_np: string | null;
        role: string | null;
        is_verified: boolean | null;
        is_active: boolean | null;
        avatar_url: string | null;
      }>();
    if (error || !data) return null;

    const patch: Partial<User> = {};
    if (
      data.role === "worker" ||
      data.role === "hirer" ||
      data.role === "admin"
    ) {
      patch.role = data.role;
    }
    if (typeof data.phone === "string" && data.phone.trim()) {
      patch.phone = data.phone.replace("+977", "");
    }
    if (typeof data.full_name === "string" && data.full_name.trim()) {
      patch.fullName = data.full_name;
    }
    if (typeof data.full_name_np === "string" && data.full_name_np.trim()) {
      patch.fullNameNp = data.full_name_np;
    }
    if (typeof data.avatar_url === "string" && data.avatar_url.trim()) {
      patch.avatarUrl = data.avatar_url;
    }
    if (typeof data.is_verified === "boolean") {
      patch.isVerified = data.is_verified;
    }
    if (typeof data.is_active === "boolean") {
      patch.isActive = data.is_active;
    }
    return patch;
  } catch {
    return null;
  }
}

function hydrateUserFromDb(
  userId: string,
  set: (partial: Partial<AuthState>) => void,
  get: () => AuthState,
) {
  if (hydratedUserId === userId) return; // skip repeat TOKEN_REFRESHED events
  hydratedUserId = userId;
  void fetchDbUser(userId).then((patch) => {
    if (!patch) return;
    const current = get().user;
    if (!current || current.id !== userId) return; // user changed meanwhile
    set({ user: { ...current, ...patch } });
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

// Auth helper functions using authApi
//
// When Supabase rejects an OTP request, the underlying GoTrue/Supabase error
// object carries a richer payload than `error.message` alone — `code`,
// `status`, and sometimes a Twilio-side hint. We capture all of it so the
// failure mode (e.g. "phone_provider_disabled", "sms_send_failed", trial
// account / geo-permission errors, rate-limit hits) is visible in the
// console without a network-tab dive.
async function requestPhoneOtp(params: { phone: string; locale: string }) {
  try {
    await authApi.requestOtp(`+977${params.phone}`);
    return { success: true };
  } catch (error) {
    const detail = describeAuthError(error);
    console.error("[auth] OTP request failed", detail);
    return {
      success: false,
      error: detail.userMessage,
    };
  }
}

function describeAuthError(error: unknown): {
  userMessage: string;
  code?: string;
  status?: number;
  raw?: unknown;
} {
  if (!error) {
    return { userMessage: "Unknown error" };
  }

  // Supabase AuthError shape: { message, status, code, name }
  if (typeof error === "object") {
    const e = error as {
      message?: unknown;
      status?: unknown;
      code?: unknown;
      name?: unknown;
    };
    const message =
      typeof e.message === "string" ? e.message : "Authentication failed";
    const status = typeof e.status === "number" ? e.status : undefined;
    const code = typeof e.code === "string" ? e.code : undefined;
    // Translate a few common codes into actionable hints rather than raw
    // GoTrue strings, so users see something useful even before opening
    // the Supabase/Twilio dashboards.
    const userMessage = (() => {
      if (code === "over_request_rate_limit" || status === 429) {
        return "Too many attempts. Wait a minute and try again.";
      }
      if (code === "sms_send_failed") {
        return "SMS provider rejected the message. Check your Supabase phone-auth and Twilio configuration.";
      }
      if (code === "phone_provider_disabled") {
        return "Phone OTP is not enabled in Supabase. Enable Phone provider in Auth settings.";
      }
      return message;
    })();
    return { userMessage, code, status, raw: error };
  }

  return { userMessage: String(error), raw: error };
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
    const detail = describeAuthError(error);
    console.error("[auth] OTP verify failed", detail);
    return { session: null, error: detail.userMessage };
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
    const detail = describeAuthError(error);
    console.error("[auth] Email sign-in failed", detail);
    return { session: null, error: detail.userMessage };
  }
}

// Result of an email registration attempt:
//  - "session": account created AND signed in (email confirmation off).
//  - "confirm": account created but the user must click the email link
//    before they can sign in (email confirmation on).
//  - "error": failed (e.g. email already registered).
type RegisterResult =
  | { kind: "session" }
  | { kind: "confirm" }
  | { kind: "error"; message: string };

async function signUpWithEmailPassword(params: {
  email: string;
  password: string;
  redirectTo?: string;
}): Promise<RegisterResult> {
  try {
    const result = await authApi.signUpWithPassword(
      params.email,
      params.password,
      params.redirectTo,
    );
    const session = mapSupabaseSession(result.session);
    return session ? { kind: "session" } : { kind: "confirm" };
  } catch (error) {
    const detail = describeAuthError(error);
    console.error("[auth] Email sign-up failed", detail);
    if (
      /already registered|already exists|user_already_exists/i.test(
        detail.userMessage,
      )
    ) {
      return {
        kind: "error",
        message:
          "This email may already have an account. Sign in or reset your password.",
      };
    }
    return { kind: "error", message: detail.userMessage };
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
  registerWithEmail: (
    email: string,
    password: string,
    redirectTo?: string,
  ) => Promise<RegisterResult>;
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

      const liveSession = mapSupabaseSession(
        await withTimeout(
          authApi.getSession(),
          AUTH_SESSION_TIMEOUT_MS,
          "Auth session check timed out.",
        ),
      );
      set({
        session: liveSession,
        user: liveSession?.user ?? null,
        isAuthenticated: !!liveSession,
        isLoading: false,
        authError: null,
      });
      // Attribute Sentry errors to the signed-in user (id only — no PII).
      // No-op when Sentry isn't configured.
      setUserContext(liveSession?.user ? { id: liveSession.user.id } : null);
      if (liveSession?.user) {
        hydrateUserFromDb(liveSession.user.id, set, get);
      }

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
          // Covers every later transition: SIGNED_IN / SIGNED_OUT /
          // TOKEN_REFRESHED. Clears the user on sign-out.
          setUserContext(
            nextSession?.user ? { id: nextSession.user.id } : null,
          );
          if (nextSession?.user) {
            hydrateUserFromDb(nextSession.user.id, set, get);
          } else {
            hydratedUserId = null;
          }
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

  registerWithEmail: async (
    email: string,
    password: string,
    redirectTo?: string,
  ): Promise<RegisterResult> => {
    set({ isLoading: true });
    try {
      if (!isSupabaseConfigured()) {
        set({ isLoading: false });
        return { kind: "error", message: "Sign-up is currently unavailable." };
      }
      getSupabaseClient();
      const result = await signUpWithEmailPassword({
        email,
        password,
        redirectTo,
      });

      // When a session came back, the account is created AND signed in —
      // reflect that in the store so the app is immediately authenticated.
      if (result.kind === "session") {
        const liveSession = mapSupabaseSession(
          await withTimeout(
            authApi.getSession(),
            AUTH_SESSION_TIMEOUT_MS,
            "Auth session check timed out.",
          ),
        );
        set({
          user: liveSession?.user ?? null,
          session: liveSession,
          isAuthenticated: !!liveSession,
          isLoading: false,
          authError: null,
        });
      } else {
        set({ isLoading: false });
      }
      return result;
    } catch (err) {
      set({ isLoading: false });
      return {
        kind: "error",
        message:
          err instanceof Error ? err.message : "Sign-up failed. Try again.",
      };
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

    // Wipe cached query data so the next user (e.g. after logging in with a
    // different email on a shared device) never sees the previous user's data.
    hydratedUserId = null;
    try {
      clearQueryCaches();
    } catch (error) {
      console.error("Failed to clear query caches on logout:", error);
    }
  },
}));
