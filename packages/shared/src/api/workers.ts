import { getSupabase } from "./client";
import { firstRelation, safeDate, validateLocationContext } from "./common";
import type { Database } from "./database.types";
import type { WorkerDisplay } from "../types";
import {
  updateWorkerProfileSchema,
  type UpdateWorkerProfileInput,
} from "../validation";

export interface WorkerFilters {
  provinceId?: number;
  districtId?: number;
  localUnitId?: number;
  wardNo?: number;
  jobCategoryId?: number;
  isAvailable?: boolean;
  minRating?: number;
  maxDailyRate?: number;
  search?: string;
  // Proximity anchor for smart ranking — the SEARCHER's own location. Drives
  // the proximity term in `search_workers_ranked` independently of the hard
  // location filters above, so nearby workers rank first even when filters are
  // coarse/unset. Optional; falls back to the filter location server-side.
  anchorProvinceId?: number;
  anchorDistrictId?: number;
  anchorLocalUnitId?: number;
  anchorWardNo?: number;
  // Server-side ordering. Used by the "Most Hired" listing to rank by
  // total_hires; defaults to newest-first when unset.
  sortBy?: "total_hires" | "avg_rating" | "daily_rate_npr" | "created_at";
  sortDirection?: "asc" | "desc";
}

// Whitelist of columns the client is allowed to sort by — prevents an
// arbitrary string from reaching the query builder.
const SORTABLE_COLUMNS: Record<
  NonNullable<WorkerFilters["sortBy"]>,
  string
> = {
  total_hires: "total_hires",
  avg_rating: "avg_rating",
  daily_rate_npr: "daily_rate_npr",
  created_at: "created_at",
};

type WorkerRelation = {
  user?:
    | {
        full_name?: string | null;
        full_name_np?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
      }
    | Array<{
        full_name?: string | null;
        full_name_np?: string | null;
        phone?: string | null;
        avatar_url?: string | null;
      }>
    | null;
  job_category?:
    | {
        name_en?: string | null;
        name_np?: string | null;
        icon?: string | null;
      }
    | Array<{
        name_en?: string | null;
        name_np?: string | null;
        icon?: string | null;
      }>
    | null;
  province?:
    | {
        name_en?: string | null;
        name_np?: string | null;
      }
    | Array<{
        name_en?: string | null;
        name_np?: string | null;
      }>
    | null;
  district?:
    | {
        name_en?: string | null;
        name_np?: string | null;
      }
    | Array<{
        name_en?: string | null;
        name_np?: string | null;
      }>
    | null;
  local_unit?:
    | {
        name_en?: string | null;
        name_np?: string | null;
        unit_type?:
          | "metropolitan"
          | "sub_metropolitan"
          | "municipality"
          | "rural_municipality"
          | null;
      }
    | Array<{
        name_en?: string | null;
        name_np?: string | null;
        unit_type?:
          | "metropolitan"
          | "sub_metropolitan"
          | "municipality"
          | "rural_municipality"
          | null;
      }>
    | null;
};

type WorkerRow = Database["public"]["Tables"]["worker_profiles"]["Row"] &
  WorkerRelation;

export function mapWorkerRow(row: WorkerRow): WorkerDisplay {
  const user = firstRelation(row.user);
  const jobCategory = firstRelation(row.job_category);
  const province = firstRelation(row.province);
  const district = firstRelation(row.district);
  const localUnit = firstRelation(row.local_unit);

  return {
    id: row.id,
    userId: row.user_id,
    fullName: user?.full_name ?? "",
    fullNameNp: user?.full_name_np ?? undefined,
    avatarUrl: user?.avatar_url ?? undefined,
    jobCategoryId: row.job_category_id,
    jobCategoryNameEn: jobCategory?.name_en ?? undefined,
    jobCategoryNameNp: jobCategory?.name_np ?? undefined,
    provinceId: row.province_id,
    districtId: row.district_id,
    districtNameEn: district?.name_en ?? undefined,
    districtNameNp: district?.name_np ?? undefined,
    localUnitId: row.local_unit_id,
    localUnitNameEn: localUnit?.name_en ?? undefined,
    localUnitNameNp: localUnit?.name_np ?? undefined,
    wardNo: row.ward_no,
    isAvailable: row.is_available,
    isApproved: row.is_approved,
    approvalNote: row.approval_note ?? undefined,
    experienceYrs: row.experience_yrs,
    about: row.about ?? undefined,
    dailyRateNpr: row.daily_rate_npr ?? undefined,
    citizenshipNo: row.citizenship_no ?? undefined,
    totalHires: row.total_hires,
    pendingHires: row.pending_hires,
    avgRating: row.avg_rating,
    totalReviews: row.total_reviews,
    createdAt: safeDate(row.created_at),
    updatedAt: safeDate(row.updated_at),
    user: {
      fullName: user?.full_name ?? "",
      fullNameNp: user?.full_name_np ?? undefined,
      phone: user?.phone ?? "",
      avatarUrl: user?.avatar_url ?? undefined,
    },
    jobCategory: {
      nameEn: jobCategory?.name_en ?? "",
      nameNp: jobCategory?.name_np ?? "",
      icon: jobCategory?.icon ?? undefined,
    },
    province: {
      nameEn: province?.name_en ?? "",
      nameNp: province?.name_np ?? "",
    },
    district: {
      nameEn: district?.name_en ?? "",
      nameNp: district?.name_np ?? undefined,
    },
    localUnit: {
      nameEn: localUnit?.name_en ?? "",
      nameNp: localUnit?.name_np ?? undefined,
      unitType: localUnit?.unit_type ?? "municipality",
    },
  };
}

export const workersApi = {
  /**
   * Search workers with filters
   */
  async search(filters: WorkerFilters, page = 1, pageSize = 20) {
    const supabase = getSupabase();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const relationSelect = `
        *,
        user:users(full_name, full_name_np, avatar_url),
        job_category:job_categories(name_en, name_np, icon),
        province:provinces(name_en, name_np),
        district:districts(name_en, name_np),
        local_unit:local_units(name_en, name_np, unit_type)
      `;

    // ── Smart serverless ranking ─────────────────────────────────────────
    // Default ordering uses the proximity-first composite score computed by
    // the `search_workers_ranked` Postgres function (runs inside Supabase, no
    // app server). The RPC returns the ranked page of ids + the total match
    // count; we hydrate the full rows (with relations) and preserve rank order.
    // Skipped when the caller asked for an explicit sort (e.g. "Most Hired"),
    // and it transparently falls back to the plain query below if the function
    // isn't deployed yet or errors — so behaviour degrades gracefully.
    if (!filters.sortBy) {
      try {
        const { data: ranked, error: rpcError } = await (supabase as any).rpc(
          "search_workers_ranked",
          {
            p_province_id: filters.provinceId ?? null,
            p_district_id: filters.districtId ?? null,
            p_local_unit_id: filters.localUnitId ?? null,
            p_ward_no: filters.wardNo ?? null,
            p_job_category_id: filters.jobCategoryId ?? null,
            p_available: filters.isAvailable ?? null,
            p_search: filters.search?.trim() || null,
            p_limit: pageSize,
            p_offset: from,
            p_anchor_province_id: filters.anchorProvinceId ?? null,
            p_anchor_district_id: filters.anchorDistrictId ?? null,
            p_anchor_local_unit_id: filters.anchorLocalUnitId ?? null,
            p_anchor_ward_no: filters.anchorWardNo ?? null,
          },
        );
        if (rpcError) throw rpcError;

        const rankedRows = (ranked ?? []) as Array<{
          id: string;
          score: number;
          total_count: number | string;
        }>;
        const total = Number(rankedRows[0]?.total_count ?? 0);

        if (rankedRows.length === 0) {
          return { data: [], total, page, pageSize, hasMore: false };
        }

        const ids = rankedRows.map((r) => r.id);
        const { data: full, error: fullError } = await supabase
          .from("worker_profiles")
          .select(relationSelect)
          .in("id", ids);
        if (fullError) throw fullError;

        const byId = new Map(
          ((full ?? []) as WorkerRow[]).map((row) => [row.id, mapWorkerRow(row)]),
        );
        // Re-apply the rank order the RPC returned (a SQL `IN (...)` does not
        // guarantee row order, so we key off the ranked id list).
        const rankedData = ids
          .map((id) => byId.get(id))
          .filter((w): w is WorkerDisplay => Boolean(w));

        return {
          data: rankedData,
          total,
          page,
          pageSize,
          hasMore: from + rankedData.length < total,
        };
      } catch {
        // Fall through to the plain query (newest-first) below.
      }
    }

    let query = supabase
      .from("worker_profiles")
      .select(relationSelect, { count: "exact" })
      // Self-serve model: visibility is enforced by RLS (owning user must be
      // active), NOT by is_approved. is_approved is only a "Verified" badge.
      .range(from, to);

    if (filters.isAvailable !== undefined) {
      query = query.eq("is_available", filters.isAvailable);
    }

    // Apply filters
    if (filters.provinceId) query = query.eq("province_id", filters.provinceId);
    if (filters.districtId) query = query.eq("district_id", filters.districtId);
    if (filters.localUnitId)
      query = query.eq("local_unit_id", filters.localUnitId);
    if (filters.wardNo) query = query.eq("ward_no", filters.wardNo);
    if (filters.jobCategoryId)
      query = query.eq("job_category_id", filters.jobCategoryId);
    if (filters.minRating) query = query.gte("avg_rating", filters.minRating);
    if (filters.maxDailyRate)
      query = query.lte("daily_rate_npr", filters.maxDailyRate);

    if (filters.search) {
      const s = `%${filters.search}%`;
      // Refactored to avoid dot-notation in .or() which can cause "Database error querying schema"
      // We'll stick to fields in the base table for now.
      query = query.ilike("about", s);
    }

    // Ordering: validated against the whitelist so only known columns
    // reach the query. Default = newest worker first. The "Most Hired"
    // page passes sortBy: "total_hires", sortDirection: "desc".
    const sortColumn = filters.sortBy
      ? SORTABLE_COLUMNS[filters.sortBy]
      : "created_at";
    const ascending = filters.sortDirection === "asc";
    query = query.order(sortColumn, { ascending, nullsFirst: false });

    const { data, error, count } = await query;
    if (error) throw error;

    const workers = ((data ?? []) as WorkerRow[]).map(mapWorkerRow);

    return {
      data: workers,
      total: count ?? 0,
      page,
      pageSize,
      hasMore: (count ?? 0) > to + 1,
    };
  },

  /**
   * Get single worker by ID
   */
  async getById(workerId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("worker_profiles")
      .select(
        `
        *,
        user:users(full_name, full_name_np, avatar_url),
        job_category:job_categories(name_en, name_np, icon),
        province:provinces(name_en, name_np),
        district:districts(name_en, name_np),
        local_unit:local_units(name_en, name_np, unit_type)
      `,
      )
      .eq("id", workerId)
      .single();

    if (error) throw error;
    return mapWorkerRow(data as WorkerRow);
  },

  async getByUserId(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("worker_profiles")
      .select(
        `
        *,
        user:users(full_name, full_name_np, avatar_url),
        job_category:job_categories(name_en, name_np, icon),
        province:provinces(name_en, name_np),
        district:districts(name_en, name_np),
        local_unit:local_units(name_en, name_np, unit_type)
      `,
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return null;
    }

    return mapWorkerRow(data as WorkerRow);
  },
};

export const workerProfilesApi = {
  async updateById(
    profileId: string,
    input: UpdateWorkerProfileInput,
  ): Promise<WorkerDisplay> {
    const supabase = getSupabase();
    const parsed = updateWorkerProfileSchema.parse(input);

    const { data: existingProfileRaw, error: existingProfileError } = await (
      supabase as any
    )
      .from("worker_profiles")
      .select("province_id, district_id, local_unit_id")
      .eq("id", profileId)
      .single();

    const existingProfile = existingProfileRaw as {
      province_id: number;
      district_id: number;
      local_unit_id: number;
    } | null;

    if (existingProfileError || !existingProfile) {
      throw existingProfileError ?? new Error("Worker profile not found.");
    }

    await validateLocationContext(supabase, {
      provinceId: parsed.provinceId ?? existingProfile.province_id,
      districtId: parsed.districtId ?? existingProfile.district_id,
      localUnitId: parsed.localUnitId ?? existingProfile.local_unit_id,
    });

    const patch: Database["public"]["Tables"]["worker_profiles"]["Update"] = {};

    if (parsed.jobCategoryId !== undefined) {
      patch.job_category_id = parsed.jobCategoryId;
    }

    if (parsed.provinceId !== undefined) {
      patch.province_id = parsed.provinceId;
    }

    if (parsed.districtId !== undefined) {
      patch.district_id = parsed.districtId;
    }

    if (parsed.localUnitId !== undefined) {
      patch.local_unit_id = parsed.localUnitId;
    }

    if (parsed.wardNo !== undefined) {
      patch.ward_no = parsed.wardNo;
    }

    if (parsed.experienceYrs !== undefined) {
      patch.experience_yrs = parsed.experienceYrs;
    }

    if (parsed.about !== undefined) {
      patch.about = parsed.about;
    }

    if (parsed.dailyRateNpr !== undefined) {
      patch.daily_rate_npr = parsed.dailyRateNpr;
    }

    if (parsed.citizenshipNo !== undefined) {
      patch.citizenship_no = parsed.citizenshipNo;
    }

    if (parsed.isAvailable !== undefined) {
      patch.is_available = parsed.isAvailable;
    }

    const { data, error } = await (supabase as any)
      .from("worker_profiles")
      .update(patch as any)
      .eq("id", profileId)
      .select(
        `
        *,
        user:users(full_name, full_name_np, avatar_url),
        job_category:job_categories(name_en, name_np, icon),
        province:provinces(name_en, name_np),
        district:districts(name_en, name_np),
        local_unit:local_units(name_en, name_np, unit_type)
      `,
      )
      .single();

    if (error) throw error;
    return mapWorkerRow(data as WorkerRow);
  },

  /**
   * Upsert worker profile by user ID
   */
  async upsertByUserId(userId: string, input: UpdateWorkerProfileInput) {
    const supabase = getSupabase();

    // Check for existing profile
    const { data: existing } = await supabase
      .from("worker_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      return this.updateById((existing as any).id, input);
    }

    const { data, error } = await (supabase as any)
      .from("worker_profiles")
      .insert({
        user_id: userId,
        job_category_id: input.jobCategoryId,
        province_id: input.provinceId,
        district_id: input.districtId,
        local_unit_id: input.localUnitId,
        ward_no: input.wardNo || 1,
        experience_yrs: input.experienceYrs || 0,
        about: input.about || "",
        daily_rate_npr: input.dailyRateNpr || 0,
        is_available: input.isAvailable ?? true,
      } as any)
      .select(
        `
        *,
        user:users(full_name, full_name_np, avatar_url),
        job_category:job_categories(name_en, name_np, icon),
        province:provinces(name_en, name_np),
        district:districts(name_en, name_np),
        local_unit:local_units(name_en, name_np, unit_type)
      `,
      )
      .single();

    if (error) throw error;
    return mapWorkerRow(data as WorkerRow);
  },
};
