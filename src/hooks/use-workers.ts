/**
 * useWorkers hook — TanStack Query
 * Fetches and caches worker data
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workersApi, type WorkerFilters } from "@shram-sewa/shared/api";
import { queryKeys } from "../lib/query-client";
import { getSupabaseClient, isSupabaseConfigured } from "../lib";

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

/**
 * Search workers with filters
 */
export function useWorkers(
  filters: WorkerFilters,
  page = 1,
  pageSize = 20,
  enabled = true,
) {
  const backendReady = enabled && canUseBackend();

  return useQuery({
    queryKey: queryKeys.workers.search({ ...filters, page, pageSize }),
    queryFn: () => workersApi.search(filters, page, pageSize),
    enabled: backendReady,
    networkMode: "offlineFirst",
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: (previousData) => previousData, // Keep old data while fetching
  });
}

/**
 * Get the most hired workers for spotlight listings.
 */
export function useMostHiredWorkers(
  pageSize = 12,
  enabled = true,
  isAvailable?: boolean,
) {
  return useWorkers(
    {
      sortBy: "total_hires",
      sortDirection: "desc",
      isAvailable,
    },
    1,
    pageSize,
    enabled,
  );
}

/**
 * Get single worker by ID
 */
export function useWorker(workerId: string | undefined, enabled = true) {
  const backendReady = enabled && canUseBackend();

  return useQuery({
    queryKey: queryKeys.workers.detail(workerId ?? ""),
    queryFn: () => workersApi.getById(workerId!),
    enabled: backendReady && !!workerId,
    networkMode: "offlineFirst",
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Prefetch worker for navigation
 */
export function usePrefetchWorker() {
  const queryClient = useQueryClient();

  return (workerId: string) => {
    if (!canUseBackend()) {
      return;
    }

    queryClient.prefetchQuery({
      queryKey: queryKeys.workers.detail(workerId),
      queryFn: () => workersApi.getById(workerId),
      staleTime: 10 * 60 * 1000,
    });
  };
}
