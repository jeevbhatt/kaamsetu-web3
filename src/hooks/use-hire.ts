import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hireApi,
  notificationsApi,
  workersApi,
  type CreateHireRequest,
} from "@shram-sewa/shared/api";
import type {
  SubmitReviewInput,
  UpdateHireStatusInput,
} from "@shram-sewa/shared";
import { useAuthStore } from "../store/auth-store";
import { reportWebError } from "../lib/monitoring";
import { queryKeys } from "../lib/query-client";
import { getSupabaseClient, isSupabaseConfigured } from "../lib";
import {
  enqueueHireOutbox,
  isLikelyNetworkCutoffError,
} from "../lib/hire-outbox";

function canUseBackend() {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    getSupabaseClient();
    return true;
  } catch {
    return false;
  }
}

export function useHireRecord(hireId: string | undefined, enabled = true) {
  const backendReady = enabled && canUseBackend();

  return useQuery({
    queryKey: queryKeys.hires.detail(hireId ?? ""),
    queryFn: () => hireApi.getById(hireId!),
    enabled: backendReady && !!hireId,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMyHires(enabled = true) {
  const backendReady = enabled && canUseBackend();
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: queryKeys.hires.byHirer(userId ?? ""),
    queryFn: () => hireApi.listByHirer(userId!),
    enabled: backendReady && !!userId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// The logged-in user's own worker profile (null if they are a hirer).
// Used by the worker-side dashboard to look up the worker_profile.id
// that gates incoming hire queries — `hireApi.listByWorker` keys off
// the profile id, not the user id.
export function useMyWorkerProfile(enabled = true) {
  const backendReady = enabled && canUseBackend();
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: ["worker-profiles", "by-user", userId ?? ""],
    queryFn: () => workersApi.getByUserId(userId!),
    enabled: backendReady && !!userId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Hire requests INCOMING to the current worker — the worker side of the
// hire history (counterpart to useMyHires, which is the hirer side).
// Empty array when called by a hirer or before the worker profile loads.
export function useIncomingHires(
  workerProfileId: string | undefined,
  enabled = true,
) {
  const backendReady = enabled && canUseBackend();

  return useQuery({
    queryKey: queryKeys.hires.byWorker(workerProfileId ?? ""),
    queryFn: () => hireApi.listByWorker(workerProfileId!),
    enabled: backendReady && !!workerProfileId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateHireMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHireRequest) => hireApi.create(input),
    onSuccess: (hire) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hires.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byWorker(hire.workerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byHirer(hire.hirerId),
      });

      void notificationsApi.dispatchHireRequest(hire.id).catch((error) => {
        console.warn("Worker notification dispatch failed:", error);
        void reportWebError({
          category: "notification",
          level: "warning",
          message:
            error instanceof Error
              ? error.message
              : "Worker notification dispatch failed",
          stack: error instanceof Error ? error.stack : undefined,
          context: {
            hireId: hire.id,
            workerId: hire.workerId,
            hirerId: hire.hirerId,
          },
        });
      });
    },
    onError: (error, input) => {
      if (!isLikelyNetworkCutoffError(error)) {
        return;
      }

      const { queued, duplicate } = enqueueHireOutbox(input);
      if (!queued) {
        return;
      }

      void reportWebError({
        category: "network",
        level: "warning",
        message: duplicate
          ? "Hire request already queued for retry"
          : "Hire request queued for retry after network cutoff",
        context: {
          workerId: input.workerId,
          hasHirerIp: Boolean(input.hirerIp),
          duplicate,
        },
      });
    },
  });
}

export function useUpdateHireStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHireStatusInput) => hireApi.updateStatus(input),
    onSuccess: (hire) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hires.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.detail(hire.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byWorker(hire.workerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byHirer(hire.hirerId),
      });
    },
  });
}

export function useSubmitHireReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SubmitReviewInput) => hireApi.submitReview(input),
    onSuccess: (hire) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.detail(hire.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byWorker(hire.workerId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hires.byHirer(hire.hirerId),
      });
    },
  });
}
