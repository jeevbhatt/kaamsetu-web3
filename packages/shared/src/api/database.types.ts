/**
 * Database types placeholder
 * TODO: Generate from Supabase CLI with `supabase gen types typescript`
 */

export interface Database {
  public: {
    Tables: {
      provinces: {
        Row: {
          id: number;
          name_en: string;
          name_np: string;
          color_hex: string | null;
          created_at: string;
        };
        Insert: {
          id: number;
          name_en: string;
          name_np: string;
          color_hex?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["provinces"]["Insert"]>;
      };
      districts: {
        Row: {
          id: number;
          province_id: number;
          name_en: string;
          name_np: string | null;
          created_at: string;
        };
        Insert: {
          id: number;
          province_id: number;
          name_en: string;
          name_np?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["districts"]["Insert"]>;
      };
      local_units: {
        Row: {
          id: number;
          district_id: number;
          name_en: string;
          name_np: string | null;
          unit_type:
            | "metropolitan"
            | "sub_metropolitan"
            | "municipality"
            | "rural_municipality";
          ward_count: number;
          created_at: string;
        };
        Insert: {
          district_id: number;
          name_en: string;
          name_np?: string | null;
          unit_type:
            | "metropolitan"
            | "sub_metropolitan"
            | "municipality"
            | "rural_municipality";
          ward_count?: number;
        };
        Update: Partial<Database["public"]["Tables"]["local_units"]["Insert"]>;
      };
      job_categories: {
        Row: {
          id: number;
          slug: string;
          name_en: string;
          name_np: string;
          icon: string | null;
          description: string | null;
          is_active: boolean;
        };
        Insert: {
          slug: string;
          name_en: string;
          name_np: string;
          icon?: string | null;
          description?: string | null;
          is_active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["job_categories"]["Insert"]
        >;
      };
      users: {
        Row: {
          id: string;
          phone: string | null;
          full_name: string | null;
          full_name_np: string | null;
          role: "worker" | "hirer" | "admin";
          is_verified: boolean;
          is_active: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          phone?: string | null;
          full_name?: string | null;
          full_name_np?: string | null;
          role?: "worker" | "hirer" | "admin";
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      worker_profiles: {
        Row: {
          id: string;
          user_id: string;
          job_category_id: number;
          province_id: number;
          district_id: number;
          local_unit_id: number;
          ward_no: number;
          is_available: boolean;
          is_approved: boolean;
          approval_note: string | null;
          experience_yrs: number;
          about: string | null;
          daily_rate_npr: number | null;
          citizenship_no: string | null;
          total_hires: number;
          pending_hires: number;
          avg_rating: number;
          total_reviews: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          job_category_id: number;
          province_id: number;
          district_id: number;
          local_unit_id: number;
          ward_no: number;
          is_available?: boolean;
          is_approved?: boolean;
          approval_note?: string | null;
          experience_yrs?: number;
          about?: string | null;
          daily_rate_npr?: number | null;
          citizenship_no?: string | null;
          total_hires?: number;
          pending_hires?: number;
          avg_rating?: number;
          total_reviews?: number;
        };
        Update: {
          user_id?: string;
          job_category_id?: number;
          province_id?: number;
          district_id?: number;
          local_unit_id?: number;
          ward_no?: number;
          is_available?: boolean;
          is_approved?: boolean;
          approval_note?: string | null;
          experience_yrs?: number;
          about?: string | null;
          daily_rate_npr?: number | null;
          citizenship_no?: string | null;
          total_hires?: number;
          pending_hires?: number;
          avg_rating?: number;
          total_reviews?: number;
        };
      };
      hire_records: {
        Row: {
          id: string;
          worker_id: string;
          hirer_id: string;
          hirer_ip: string;
          ip_fingerprint: string | null;
          status:
            | "pending"
            | "accepted"
            | "rejected"
            | "completed"
            | "cancelled";
          hire_province_id: number | null;
          hire_district_id: number | null;
          hire_local_unit_id: number | null;
          work_description: string | null;
          agreed_rate_npr: number | null;
          work_date: string | null;
          work_duration_days: number;
          hired_at: string;
          accepted_at: string | null;
          completed_at: string | null;
          cancelled_at: string | null;
          rating: number | null;
          review_text: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          worker_id: string;
          hirer_id: string;
          hirer_ip: string;
          ip_fingerprint?: string | null;
          status?:
            | "pending"
            | "accepted"
            | "rejected"
            | "completed"
            | "cancelled";
          hire_province_id?: number | null;
          hire_district_id?: number | null;
          hire_local_unit_id?: number | null;
          work_description?: string | null;
          agreed_rate_npr?: number | null;
          work_date?: string | null;
          work_duration_days?: number;
          accepted_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          rating?: number | null;
          review_text?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          worker_id?: string;
          hirer_id?: string;
          hirer_ip?: string;
          ip_fingerprint?: string | null;
          status?:
            | "pending"
            | "accepted"
            | "rejected"
            | "completed"
            | "cancelled";
          hire_province_id?: number | null;
          hire_district_id?: number | null;
          hire_local_unit_id?: number | null;
          work_description?: string | null;
          agreed_rate_npr?: number | null;
          work_date?: string | null;
          work_duration_days?: number;
          accepted_at?: string | null;
          completed_at?: string | null;
          cancelled_at?: string | null;
          rating?: number | null;
          review_text?: string | null;
          reviewed_at?: string | null;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          hire_id: string | null;
          type:
            | "hire_request"
            | "hire_accepted"
            | "hire_rejected"
            | "hire_completed"
            | "new_review"
            | "system";
          title: string;
          title_np: string | null;
          body: string;
          body_np: string | null;
          is_read: boolean;
          push_sent: boolean;
          push_token: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type:
            | "hire_request"
            | "hire_accepted"
            | "hire_rejected"
            | "hire_completed"
            | "new_review"
            | "system";
          title: string;
          body: string;
          hire_id?: string | null;
          title_np?: string | null;
          body_np?: string | null;
          is_read?: boolean;
          push_sent?: boolean;
          push_token?: string | null;
        };
        Update: {
          user_id?: string;
          type?:
            | "hire_request"
            | "hire_accepted"
            | "hire_rejected"
            | "hire_completed"
            | "new_review"
            | "system";
          title?: string;
          body?: string;
          hire_id?: string | null;
          title_np?: string | null;
          body_np?: string | null;
          is_read?: boolean;
          push_sent?: boolean;
          push_token?: string | null;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: "android" | "ios" | "web" | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          token: string;
          platform?: "android" | "ios" | "web" | null;
          is_active?: boolean;
        };
        Update: {
          user_id?: string;
          token?: string;
          platform?: "android" | "ios" | "web" | null;
          is_active?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
