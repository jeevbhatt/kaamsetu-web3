import { getSupabase, type TypedSupabaseClient } from "./client";
import { safeDate, safeOptionalDate, validateLocationContext } from "./common";
import type { Database } from "./database.types";
import type { HireRecord, HireStatus } from "../types";
import {
  createHireRequestSchema,
  updateHireStatusSchema,
  submitReviewSchema,
  type CreateHireRequestInput,
  type SubmitReviewInput,
  type UpdateHireStatusInput,
} from "../validation";

export interface CreateHireRequest extends CreateHireRequestInput {
  hireProvinceId?: number;
  hireDistrictId?: number;
  hireLocalUnitId?: number;
}

type HireRow = Database["public"]["Tables"]["hire_records"]["Row"];

const allowedHireStatusTransitions: Record<HireStatus, HireStatus[]> = {
  pending: ["accepted", "rejected", "cancelled"],
  accepted: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
};

async function syncWorkerAvailability(
  supabase: TypedSupabaseClient,
  workerProfileId: string,
): Promise<void> {
  const { count, error } = await supabase
    .from("hire_records")
    .select("id", { count: "exact", head: true })
    .eq("worker_id", workerProfileId)
    .eq("status", "accepted");

  if (error) {
    throw error;
  }

  const isBusy = (count ?? 0) > 0;

  const { error: updateError } = await (supabase as any)
    .from("worker_profiles")
    .update({ is_available: !isBusy } as any)
    .eq("id", workerProfileId);

  if (updateError) {
    throw updateError;
  }
}

export function mapHireRow(row: HireRow): HireRecord {
  return {
    id: row.id,
    workerId: row.worker_id,
    hirerId: row.hirer_id,
    hirerIp: row.hirer_ip,
    ipFingerprint: row.ip_fingerprint ?? undefined,
    status: row.status as HireStatus,
    hireProvinceId: row.hire_province_id ?? undefined,
    hireDistrictId: row.hire_district_id ?? undefined,
    hireLocalUnitId: row.hire_local_unit_id ?? undefined,
    workDescription: row.work_description ?? undefined,
    agreedRateNpr: row.agreed_rate_npr ?? undefined,
    workDate: safeOptionalDate(row.work_date),
    workDurationDays: row.work_duration_days,
    hiredAt: safeDate(row.hired_at),
    acceptedAt: safeOptionalDate(row.accepted_at),
    completedAt: safeOptionalDate(row.completed_at),
    cancelledAt: safeOptionalDate(row.cancelled_at),
    rating: row.rating ?? undefined,
    reviewText: row.review_text ?? undefined,
    reviewedAt: safeOptionalDate(row.reviewed_at),
  };
}

export const hireApi = {
  async create(request: CreateHireRequest): Promise<HireRecord> {
    const supabase = getSupabase();
    const parsed = createHireRequestSchema.parse(request);

    await validateLocationContext(supabase, {
      provinceId: parsed.hireProvinceId,
      districtId: parsed.hireDistrictId,
      localUnitId: parsed.hireLocalUnitId,
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const hirerId = userData.user?.id;
    if (!hirerId) {
      throw new Error("Authentication is required to create a hire request.");
    }

    if (!parsed.hirerIp) {
      const { data, error } = await supabase.functions.invoke("hire-worker", {
        body: {
          workerId: parsed.workerId,
          ipFingerprint: parsed.ipFingerprint,
          workDescription: parsed.workDescription,
          agreedRateNpr: parsed.agreedRateNpr,
          workDate: parsed.workDate
            ? parsed.workDate.toISOString().slice(0, 10)
            : undefined,
          workDurationDays: parsed.workDurationDays,
          hireProvinceId: parsed.hireProvinceId,
          hireDistrictId: parsed.hireDistrictId,
          hireLocalUnitId: parsed.hireLocalUnitId,
        },
      });

      if (error) throw error;

      const functionPayload = data as {
        hireRecord?: HireRow;
        error?: string;
      } | null;

      if (!functionPayload?.hireRecord) {
        throw new Error(
          functionPayload?.error ??
            "Server-side hire creation did not return a hire record.",
        );
      }

      return mapHireRow(functionPayload.hireRecord);
    }

    const payload: Database["public"]["Tables"]["hire_records"]["Insert"] = {
      worker_id: parsed.workerId,
      hirer_id: hirerId,
      hirer_ip: parsed.hirerIp,
      ip_fingerprint: parsed.ipFingerprint ?? null,
      hire_province_id: parsed.hireProvinceId ?? null,
      hire_district_id: parsed.hireDistrictId ?? null,
      hire_local_unit_id: parsed.hireLocalUnitId ?? null,
      work_description: parsed.workDescription ?? null,
      agreed_rate_npr: parsed.agreedRateNpr ?? null,
      work_date: parsed.workDate
        ? parsed.workDate.toISOString().slice(0, 10)
        : null,
      work_duration_days: parsed.workDurationDays,
      status: "pending",
    };

    const { data, error } = await (supabase as any)
      .from("hire_records")
      .insert(payload as any)
      .select("*")
      .single();

    if (error) throw error;
    return mapHireRow(data as HireRow);
  },

  async updateStatus(input: UpdateHireStatusInput): Promise<HireRecord> {
    const supabase = getSupabase();
    const parsed = updateHireStatusSchema.parse(input);
    const now = new Date().toISOString();

    const { data: existingHireRaw, error: existingHireError } = await (
      supabase as any
    )
      .from("hire_records")
      .select("id, worker_id, status")
      .eq("id", parsed.hireId)
      .single();

    const existingHire = existingHireRaw as {
      id: string;
      worker_id: string;
      status: HireStatus;
    } | null;

    if (existingHireError || !existingHire) {
      throw existingHireError ?? new Error("Hire record not found.");
    }

    const currentStatus = existingHire.status as HireStatus;
    if (parsed.status !== currentStatus) {
      const allowedStatuses = allowedHireStatusTransitions[currentStatus] ?? [];
      if (!allowedStatuses.includes(parsed.status)) {
        throw new Error(
          `Invalid status transition from ${currentStatus} to ${parsed.status}.`,
        );
      }
    }

    const patch: Database["public"]["Tables"]["hire_records"]["Update"] = {
      status: parsed.status,
    };

    if (parsed.status === "accepted") {
      patch.accepted_at = now;
    }

    if (parsed.status === "completed") {
      patch.completed_at = now;
    }

    if (parsed.status === "cancelled") {
      patch.cancelled_at = now;
    }

    const { data, error } = await (supabase as any)
      .from("hire_records")
      .update(patch as any)
      .eq("id", parsed.hireId)
      .select("*")
      .single();

    if (error) throw error;

    await syncWorkerAvailability(supabase, (data as HireRow).worker_id);

    return mapHireRow(data as HireRow);
  },

  async submitReview(input: SubmitReviewInput): Promise<HireRecord> {
    const supabase = getSupabase();
    const parsed = submitReviewSchema.parse(input);

    const patch: Database["public"]["Tables"]["hire_records"]["Update"] = {
      rating: parsed.rating,
      review_text: parsed.reviewText ?? null,
      reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase as any)
      .from("hire_records")
      .update(patch as any)
      .eq("id", parsed.hireId)
      .select("*")
      .single();

    if (error) throw error;
    return mapHireRow(data as HireRow);
  },

  async getById(hireId: string): Promise<HireRecord> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("hire_records")
      .select("*")
      .eq("id", hireId)
      .single();

    if (error) throw error;
    return mapHireRow(data as HireRow);
  },

  async listByHirer(hirerId: string): Promise<HireRecord[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("hire_records")
      .select("*")
      .eq("hirer_id", hirerId)
      .order("hired_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as HireRow[]).map(mapHireRow);
  },

  async listByWorker(workerId: string): Promise<HireRecord[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from("hire_records")
      .select("*")
      .eq("worker_id", workerId)
      .order("hired_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as HireRow[]).map(mapHireRow);
  },
};
