import { getSupabase } from "./client";

export const geodataApi = {
  /**
   * Get all provinces
   */
  async getProvinces() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("provinces")
      .select("*")
      .order("id");
    if (error) throw error;
    return data;
  },

  /**
   * Get districts by province
   */
  async getDistricts(provinceId: number) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("districts")
      .select("*")
      .eq("province_id", provinceId)
      .order("name_en");
    if (error) throw error;
    return data;
  },

  /**
   * Get local units by district
   */
  async getLocalUnits(districtId: number) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("local_units")
      .select("*")
      .eq("district_id", districtId)
      .order("name_en");
    if (error) throw error;
    return data;
  },
};
