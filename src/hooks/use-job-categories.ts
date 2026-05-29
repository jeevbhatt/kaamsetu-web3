import { useQuery } from "@tanstack/react-query";
import { getSupabaseClient } from "../lib";
import { queryKeys } from "../lib/query-client";

export function useJobCategories(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.jobCategories.all,
    queryFn: async () => {
      const { data, error } = await getSupabaseClient()
        .from("job_categories")
        .select("*")
        .eq("is_active", true)
        .order("name_en");

      if (error) throw error;
      return data as any[];
    },
    enabled,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
