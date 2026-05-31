/**
 * Workers data hook — TanStack Query wrapper around Supabase
 */
import { useQuery } from "@tanstack/react-query";
import { getSupabaseSafe } from "../lib/supabase";

export interface WorkerFilters {
  provinceId?: number;
  districtId?: number;
  localUnitId?: number;
  jobCategoryId?: number;
  isAvailable?: boolean;
  search?: string;
}

export interface WorkerItem {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
  jobCategoryName: string;
  jobCategoryNp: string;
  jobIcon: string;
  provinceName: string;
  provinceId: number;
  districtName: string;
  localUnitName: string;
  wardNo: number;
  isAvailable: boolean;
  experienceYrs: number;
  dailyRateNpr?: number;
  totalHires: number;
  pendingHires: number;
  avgRating: number;
  totalReviews: number;
  createdAt: string;
}

async function fetchWorkers(filters: WorkerFilters, page: number): Promise<{ data: WorkerItem[]; total: number }> {
  const supabase = getSupabaseSafe();
  if (!supabase) return { data: [], total: 0 };

  const pageSize = 24;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("worker_profiles")
    .select(`
      *,
      user:users(full_name, full_name_np, phone, avatar_url),
      job_category:job_categories(name_en, name_np, icon),
      province:provinces(name_en, name_np),
      district:districts(name_en, name_np),
      local_unit:local_units(name_en, name_np, unit_type)
    `, { count: "exact" })
    // Self-serve: visibility enforced by RLS (active user), not is_approved.
    .range(from, to)
    .order("created_at", { ascending: false });

  if (filters.provinceId) query = query.eq("province_id", filters.provinceId);
  if (filters.districtId) query = query.eq("district_id", filters.districtId);
  if (filters.localUnitId) query = query.eq("local_unit_id", filters.localUnitId);
  if (filters.jobCategoryId) query = query.eq("job_category_id", filters.jobCategoryId);
  if (filters.isAvailable !== undefined) query = query.eq("is_available", filters.isAvailable);

  const { data, error, count } = await query;
  if (error) throw error;

  const workers: WorkerItem[] = (data ?? []).map((row: any) => {
    const user = Array.isArray(row.user) ? row.user[0] : row.user;
    const job = Array.isArray(row.job_category) ? row.job_category[0] : row.job_category;
    const prov = Array.isArray(row.province) ? row.province[0] : row.province;
    const dist = Array.isArray(row.district) ? row.district[0] : row.district;
    const lu = Array.isArray(row.local_unit) ? row.local_unit[0] : row.local_unit;

    return {
      id: row.id,
      userId: row.user_id,
      fullName: user?.full_name ?? "Worker",
      phone: user?.phone ?? "",
      avatarUrl: user?.avatar_url ?? undefined,
      jobCategoryName: job?.name_en ?? "",
      jobCategoryNp: job?.name_np ?? "",
      jobIcon: job?.icon ?? "👷",
      provinceName: prov?.name_en ?? "",
      provinceId: row.province_id,
      districtName: dist?.name_en ?? "",
      localUnitName: lu?.name_en ?? "",
      wardNo: row.ward_no,
      isAvailable: row.is_available,
      experienceYrs: row.experience_yrs ?? 0,
      dailyRateNpr: row.daily_rate_npr ?? undefined,
      totalHires: row.total_hires ?? 0,
      pendingHires: row.pending_hires ?? 0,
      avgRating: Number(row.avg_rating ?? 0),
      totalReviews: row.total_reviews ?? 0,
      createdAt: row.created_at,
    };
  });

  // Client-side search filter
  let filtered = workers;
  if (filters.search) {
    const s = filters.search.toLowerCase();
    filtered = workers.filter(w =>
      w.fullName.toLowerCase().includes(s) ||
      w.jobCategoryName.toLowerCase().includes(s) ||
      w.districtName.toLowerCase().includes(s)
    );
  }

  return { data: filtered, total: count ?? 0 };
}

export function useWorkers(filters: WorkerFilters, page = 1) {
  return useQuery({
    queryKey: ["workers", filters, page],
    queryFn: () => fetchWorkers(filters, page),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

/** Fetch total worker count for stats */
export function useWorkerCount() {
  return useQuery({
    queryKey: ["worker-count"],
    queryFn: async () => {
      const supabase = getSupabaseSafe();
      if (!supabase) return { total: 0, available: 0 };

      // Counts reflect publicly-visible workers. RLS already restricts to
      // active-user profiles; no is_approved filter (self-serve model).
      const [totalRes, availRes] = await Promise.all([
        supabase.from("worker_profiles").select("id", { count: "exact", head: true }),
        supabase.from("worker_profiles").select("id", { count: "exact", head: true }).eq("is_available", true),
      ]);

      return {
        total: totalRes.count ?? 0,
        available: availRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
}

/** Fetch job category counts */
export function useJobCategoryCounts() {
  return useQuery({
    queryKey: ["job-category-counts"],
    queryFn: async () => {
      const supabase = getSupabaseSafe();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from("job_categories")
        .select("id, name_en, name_np, icon, slug")
        .eq("is_active", true);

      if (error) throw error;
      return data ?? [];
    },
    staleTime: 120_000,
  });
}
