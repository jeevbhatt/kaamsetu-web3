import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "@shram-sewa/shared";
import * as webLib from "../../src/lib";
import { useAuthStore } from "../../src/store/auth-store";

const baseUser = {
  id: "user-1",
  phone: "9811111111",
  fullName: "Ram Bahadur",
  fullNameNp: "राम बहादुर",
  role: "worker" as const,
  isVerified: true,
  isActive: true,
  createdAt: new Date("2026-04-06T00:00:00.000Z"),
  updatedAt: new Date("2026-04-06T00:00:00.000Z"),
};

const baseAdminUser = {
  id: "admin-id-1",
  phone: "",
  fullName: "System Admin",
  fullNameNp: "सिस्टम एडमिन",
  role: "admin" as const,
  isVerified: true,
  isActive: true,
  createdAt: new Date("2026-04-06T00:00:00.000Z"),
  updatedAt: new Date("2026-04-06T00:00:00.000Z"),
};

describe("web auth store smoke", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(webLib, "isSupabaseConfigured").mockReturnValue(true);
    vi.spyOn(webLib, "getSupabaseClient").mockReturnValue({} as never);

    useAuthStore.setState({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  it("requests OTP when login is started without code", async () => {
    const requestOtpSpy = vi
      .spyOn(authApi, "requestOtp")
      .mockResolvedValue({ success: true } as never);

    const result = await useAuthStore.getState().login("9812345678");

    expect(result).toBe(true);
    expect(requestOtpSpy).toHaveBeenCalledWith("+9779812345678");
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("marks user authenticated after successful OTP verification", async () => {
    const verifyOtpSpy = vi.spyOn(authApi, "verifyOtp").mockResolvedValue({
      session: {
        access_token: "token-1",
        refresh_token: "refresh-1",
        expires_at: 1900000000,
        user: {
          id: baseUser.id,
          phone: `+977${baseUser.phone}`,
          phone_confirmed_at: "2026-04-06T00:00:00.000Z",
          user_metadata: {
            full_name: baseUser.fullName,
            full_name_np: baseUser.fullNameNp,
            role: baseUser.role,
          },
        },
      },
    } as never);

    const result = await useAuthStore.getState().login("9811111111", "123456");

    expect(result).toBe(true);
    expect(verifyOtpSpy).toHaveBeenCalledWith("+9779811111111", "123456");

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe(baseUser.id);
    expect(state.user?.role).toBe("worker");
  });

  it("logs in with email and keeps admin id session", async () => {
    const signInWithPasswordSpy = vi
      .spyOn(authApi, "signInWithPassword")
      .mockResolvedValue({
        session: {
          access_token: "admin-token",
          refresh_token: "admin-refresh",
          expires_at: 1900000100,
          user: {
            id: baseAdminUser.id,
            phone: null,
            phone_confirmed_at: null,
            email: "admin@shramsewa.test",
            email_confirmed_at: "2026-04-06T00:00:00.000Z",
            user_metadata: {
              full_name: baseAdminUser.fullName,
              full_name_np: baseAdminUser.fullNameNp,
              role: baseAdminUser.role,
            },
          },
        },
      } as never);

    const result = await useAuthStore
      .getState()
      .loginWithEmail("admin@shramsewa.test", "secret123");

    expect(result).toBe(true);
    expect(signInWithPasswordSpy).toHaveBeenCalledWith(
      "admin@shramsewa.test",
      "secret123",
    );

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.id).toBe(baseAdminUser.id);
    expect(state.user?.role).toBe("admin");
    expect(state.user?.isVerified).toBe(true);
  });

  it("forwards the production confirmation redirect during email registration", async () => {
    const signUpSpy = vi.spyOn(authApi, "signUpWithPassword").mockResolvedValue({
      session: null,
    } as never);

    const result = await useAuthStore
      .getState()
      .registerWithEmail(
        "new-user@shramsewa.test",
        "secret123",
        "https://shramsewa.jeevanbhatt.com.np/profile",
      );

    expect(result).toEqual({ kind: "confirm" });
    expect(signUpSpy).toHaveBeenCalledWith(
      "new-user@shramsewa.test",
      "secret123",
      "https://shramsewa.jeevanbhatt.com.np/profile",
    );
  });

  it("turns duplicate email registration errors into a sign-in/reset hint", async () => {
    vi.spyOn(authApi, "signUpWithPassword").mockRejectedValue(
      new Error("User already registered"),
    );

    const result = await useAuthStore
      .getState()
      .registerWithEmail(
        "existing@shramsewa.test",
        "secret123",
        "https://shramsewa.jeevanbhatt.com.np/profile",
      );

    expect(result).toEqual({
      kind: "error",
      message:
        "This email may already have an account. Sign in or reset your password.",
    });
  });

  it("clears state on logout and calls auth signout", async () => {
    const signOutSpy = vi.spyOn(authApi, "signOut").mockResolvedValue();

    useAuthStore.setState({
      user: baseUser,
      session: {
        accessToken: "token-1",
        refreshToken: "refresh-1",
        expiresAt: 1900000000,
        user: baseUser,
      },
      isLoading: false,
      isAuthenticated: true,
    });

    await useAuthStore.getState().logout();

    expect(signOutSpy).toHaveBeenCalledTimes(1);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.session).toBeNull();
  });
});
