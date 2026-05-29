/**
 * Filter Store — Zustand
 * Manages worker search filters and preferences
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WorkerSearchFilters } from "@shram-sewa/shared";

interface FilterState {
  // Current filters
  filters: WorkerSearchFilters;
  searchQuery: string;

  // Last used filters (persisted across sessions)
  lastUsedFilters: WorkerSearchFilters;
  lastUsedSearchQuery: string;

  // Convenience accessors (flat access)
  provinceId: number | undefined;
  districtId: number | undefined;
  jobCategory: number | undefined;

  // Recent selections (for quick access)
  recentProvinces: number[];
  recentDistricts: number[];
  recentJobCategories: number[];

  // Actions
  setFilter: <K extends keyof WorkerSearchFilters>(
    key: K,
    value: WorkerSearchFilters[K],
  ) => void;
  setFilters: (filters: Partial<WorkerSearchFilters>) => void;
  setFiltersFromUrl: (
    filters: Partial<WorkerSearchFilters>,
    options?: { replace?: boolean },
  ) => void;
  restoreLastUsed: () => void;
  setSearchQuery: (value: string) => void;
  setSearchQueryFromUrl: (value: string) => void;
  setProvinceId: (id: number | undefined) => void;
  setDistrictId: (id: number | undefined) => void;
  setJobCategory: (id: number | undefined) => void;
  clearFilters: () => void;
  resetFilters: () => void;
  addRecentProvince: (id: number) => void;
  addRecentDistrict: (id: number) => void;
  addRecentJobCategory: (id: number) => void;
}

const defaultFilters: WorkerSearchFilters = {
  isAvailable: true,
};

export const useFilterStore = create<FilterState>()(
  persist(
    (set, get) => ({
      // Initial state
      filters: defaultFilters,
      searchQuery: "",
      lastUsedFilters: defaultFilters,
      lastUsedSearchQuery: "",
      recentProvinces: [],
      recentDistricts: [],
      recentJobCategories: [],

      // Convenience getters (computed from filters)
      get provinceId() {
        return get().filters.provinceId;
      },
      get districtId() {
        return get().filters.districtId;
      },
      get jobCategory() {
        return get().filters.jobCategoryId;
      },

      // Actions
      setFilter: (key, value) =>
        set((state) => {
          const nextFilters = { ...state.filters, [key]: value };
          return { filters: nextFilters, lastUsedFilters: nextFilters };
        }),

      setFilters: (newFilters) =>
        set((state) => {
          const nextFilters = { ...state.filters, ...newFilters };
          return { filters: nextFilters, lastUsedFilters: nextFilters };
        }),

      setFiltersFromUrl: (newFilters, options) =>
        set((state) => {
          const baseFilters = options?.replace
            ? { ...defaultFilters }
            : state.filters;
          return {
            filters: { ...baseFilters, ...newFilters },
          };
        }),

      restoreLastUsed: () =>
        set((state) => ({
          filters: state.lastUsedFilters ?? defaultFilters,
          searchQuery: state.lastUsedSearchQuery ?? "",
        })),

      setSearchQuery: (value) =>
        set(() => ({
          searchQuery: value,
          lastUsedSearchQuery: value,
        })),

      setSearchQueryFromUrl: (value) =>
        set(() => ({
          searchQuery: value,
        })),

      setProvinceId: (id) =>
        set((state) => {
          const nextFilters = { ...state.filters, provinceId: id };
          return { filters: nextFilters, lastUsedFilters: nextFilters };
        }),

      setDistrictId: (id) =>
        set((state) => {
          const nextFilters = { ...state.filters, districtId: id };
          return { filters: nextFilters, lastUsedFilters: nextFilters };
        }),

      setJobCategory: (id) =>
        set((state) => {
          const nextFilters = { ...state.filters, jobCategoryId: id };
          return { filters: nextFilters, lastUsedFilters: nextFilters };
        }),

      clearFilters: () =>
        set({
          filters: { ...defaultFilters },
          searchQuery: "",
          lastUsedFilters: { ...defaultFilters },
          lastUsedSearchQuery: "",
        }),

      resetFilters: () =>
        set({
          filters: { ...defaultFilters },
          searchQuery: "",
          lastUsedFilters: { ...defaultFilters },
          lastUsedSearchQuery: "",
        }),

      addRecentProvince: (id) =>
        set((state) => ({
          recentProvinces: [
            id,
            ...state.recentProvinces.filter((x) => x !== id),
          ].slice(0, 5),
        })),

      addRecentDistrict: (id) =>
        set((state) => ({
          recentDistricts: [
            id,
            ...state.recentDistricts.filter((x) => x !== id),
          ].slice(0, 10),
        })),

      addRecentJobCategory: (id) =>
        set((state) => ({
          recentJobCategories: [
            id,
            ...state.recentJobCategories.filter((x) => x !== id),
          ].slice(0, 5),
        })),
    }),
    {
      name: "shram-sewa-filters",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (!persistedState || typeof persistedState !== "object") {
          return persistedState as FilterState;
        }

        if (version < 2) {
          const legacy = persistedState as Partial<FilterState> & {
            filters?: WorkerSearchFilters;
            searchQuery?: string;
          };
          return {
            ...legacy,
            lastUsedFilters:
              legacy.lastUsedFilters ?? legacy.filters ?? defaultFilters,
            lastUsedSearchQuery:
              legacy.lastUsedSearchQuery ?? legacy.searchQuery ?? "",
          } as FilterState;
        }

        return persistedState as FilterState;
      },
      partialize: (state) => ({
        lastUsedFilters: state.lastUsedFilters,
        lastUsedSearchQuery: state.lastUsedSearchQuery,
        recentProvinces: state.recentProvinces,
        recentDistricts: state.recentDistricts,
        recentJobCategories: state.recentJobCategories,
      }),
      onRehydrateStorage: () => (state) => {
        state?.restoreLastUsed();
      },
    },
  ),
);
