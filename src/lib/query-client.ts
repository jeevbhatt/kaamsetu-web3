/**
 * TanStack Query configuration
 */

import { MutationCache, QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { reportWebMutationFailure } from "./monitoring";

const mutationCache = new MutationCache({
  onError: (error, variables, _context, mutation) => {
    void reportWebMutationFailure("react-query", error, {
      mutationKey: mutation.options.mutationKey,
      variables,
    });
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      // Prefer cached data first when offline or on unstable connections.
      networkMode: "offlineFirst",

      // Stale time: data is fresh for 5 minutes
      staleTime: 5 * 60 * 1000,

      // Cache time: keep in cache for 30 minutes
      gcTime: 30 * 60 * 1000,

      // Retry failed queries twice
      retry: 2,

      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Avoid unnecessary traffic on focus changes.
      refetchOnWindowFocus: false,

      // Refetch once when connectivity is restored.
      refetchOnReconnect: true,
    },
    mutations: {
      networkMode: "online",
      // Retry mutations once
      retry: 1,
    },
  },
});

const QUERY_CACHE_KEY = "shram-sewa-query-cache-v1";
let persistenceInitialized = false;

function canPersistQueryCache() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

export function setupQueryCachePersistence() {
  if (persistenceInitialized || !canPersistQueryCache()) {
    return;
  }

  const persister = createSyncStoragePersister({
    storage: window.localStorage,
    key: QUERY_CACHE_KEY,
    throttleTime: 1500,
  });

  persistQueryClient({
    queryClient,
    persister,
    maxAge: 1000 * 60 * 60 * 12, // 12 hours
    buster: "web-cache-v1",
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        if (query.state.status !== "success") {
          return false;
        }

        const [scope] = query.queryKey;
        return (
          scope === "workers" ||
          scope === "geodata" ||
          scope === "jobCategories"
        );
      },
    },
  });

  persistenceInitialized = true;
}

/**
 * Wipe all cached query data (in-memory + persisted). Call on logout and on
 * account switch so the next user never sees the previous user's cached data.
 */
export function clearQueryCaches() {
  queryClient.clear();
  if (canPersistQueryCache()) {
    window.localStorage.removeItem(QUERY_CACHE_KEY);
  }
}

/**
 * Query key factory for type-safe query keys
 */
export const queryKeys = {
  // Workers
  workers: {
    all: ["workers"] as const,
    search: (filters: Record<string, unknown>) =>
      ["workers", "search", filters] as const,
    detail: (id: string) => ["workers", "detail", id] as const,
  },
  workerProfiles: {
    all: ["worker-profiles"] as const,
    byUser: (userId: string) => ["worker-profiles", "by-user", userId] as const,
  },

  // Geodata
  geodata: {
    provinces: ["geodata", "provinces"] as const,
    districts: (provinceId: number) =>
      ["geodata", "districts", provinceId] as const,
    localUnits: (districtId: number) =>
      ["geodata", "localUnits", districtId] as const,
  },

  // Job categories
  jobCategories: {
    all: ["jobCategories"] as const,
  },

  // Hire records
  hires: {
    all: ["hires"] as const,
    byWorker: (workerId: string) => ["hires", "worker", workerId] as const,
    byHirer: (hirerId: string) => ["hires", "hirer", hirerId] as const,
    detail: (id: string) => ["hires", "detail", id] as const,
  },

  // Notifications
  notifications: {
    all: (userId: string) => ["notifications", "all", userId] as const,
    unread: (userId: string) => ["notifications", "unread", userId] as const,
  },

  // User
  user: {
    me: (id: string) => ["user", "me", id] as const,
    profile: (id: string) => ["user", "profile", id] as const,
  },
};
