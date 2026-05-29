import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { districts } from "../constants";

import type { TypedSupabaseClient } from "./client";

export const districtToProvinceIdMap = new Map(
  districts.map((district) => [district.id, district.provinceId]),
);

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export function safeDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    console.warn(`[API] Invalid date encountered: ${value}. Falling back to current date.`);
    return new Date();
  }
  return parsed;
}

export function safeOptionalDate(value: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export type LocationContextInput = {
  provinceId?: number;
  districtId?: number;
  localUnitId?: number;
};

export async function validateLocationContext(
  supabase: TypedSupabaseClient,
  location: LocationContextInput,
): Promise<void> {
  if (location.districtId && location.provinceId) {
    const expectedProvinceId = districtToProvinceIdMap.get(location.districtId);
    if (!expectedProvinceId || expectedProvinceId !== location.provinceId) {
      throw new Error("District does not belong to the selected province.");
    }
  }

  if (!location.localUnitId) {
    return;
  }

  const { data: localUnitRaw, error: localUnitError } = await (supabase as any)
    .from("local_units")
    .select("id, district_id")
    .eq("id", location.localUnitId)
    .single();

  const localUnit = localUnitRaw as { id: number; district_id: number } | null;

  if (localUnitError || !localUnit) {
    throw new Error("Invalid local unit ID.");
  }

  if (location.districtId && localUnit.district_id !== location.districtId) {
    throw new Error("Local unit does not belong to the selected district.");
  }

  if (location.provinceId) {
    const expectedProvinceId = districtToProvinceIdMap.get(
      localUnit.district_id,
    );
    if (!expectedProvinceId || expectedProvinceId !== location.provinceId) {
      throw new Error("Local unit does not belong to the selected province.");
    }
  }
}
