/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../../src/hooks/useAuth";
import * as supabaseLib from "../../src/lib/supabase";

describe("web auth redirect smoke", () => {
  it("adds the production redirect to legacy email sign-up calls", async () => {
    const signUp = vi.fn().mockResolvedValue({ error: null });
    vi.spyOn(supabaseLib, "getSupabaseSafe").mockReturnValue({
      auth: { signUp },
    } as never);

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signUp("new-user@shramsewa.test", "secret123", {
        role: "hirer",
      });
    });

    expect(signUp).toHaveBeenCalledWith({
      email: "new-user@shramsewa.test",
      password: "secret123",
      options: {
        data: { role: "hirer" },
        emailRedirectTo: "https://shramsewa.jeevanbhatt.com.np/profile",
      },
    });
  });
});
