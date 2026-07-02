/* @vitest-environment jsdom */

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { workerProfilesApi } from "@shram-sewa/shared/api";
import { useWorkerProfileUpdateMutation } from "../../src/hooks/use-worker-profile";
import { queryKeys } from "../../src/lib/query-client";

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("worker profile mutation smoke", () => {
  it("updates the logged-in worker profile cache after availability changes", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const cachedWorker = {
      id: "profile-1",
      userId: "user-1",
      isAvailable: true,
      fullName: "Jeevan Bhatt",
    };
    const updatedWorker = {
      ...cachedWorker,
      isAvailable: false,
    };

    queryClient.setQueryData(
      queryKeys.workerProfiles.byUser("user-1"),
      cachedWorker,
    );

    vi.spyOn(workerProfilesApi, "updateById").mockResolvedValue(
      updatedWorker as never,
    );

    const { result } = renderHook(() => useWorkerProfileUpdateMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        profileId: "profile-1",
        patch: { isAvailable: false },
      });
    });

    expect(
      queryClient.getQueryData(queryKeys.workerProfiles.byUser("user-1")),
    ).toEqual(updatedWorker);
  });
});
