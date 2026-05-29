import { getSupabase } from "./client";

export const jobCategoriesApi = {
  /**
   * Get all active job categories
   */
  async getAll() {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("job_categories")
      .select("*")
      .eq("is_active", true)
      .order("name_en");
    if (error) throw error;
    return data;
  },
};
