import { getSupabase } from "./client";

export interface ReportClientErrorInput {
  source: "web" | "android" | "shared" | "edge";
  category:
    | "runtime"
    | "mutation"
    | "query"
    | "auth"
    | "network"
    | "notification"
    | "unknown";
  level?: "error" | "warning" | "info";
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export interface ReportClientErrorResult {
  logged: boolean;
  id?: number;
}

export const monitoringApi = {
  async reportClientError(
    input: ReportClientErrorInput,
  ): Promise<ReportClientErrorResult> {
    const supabase = getSupabase();

    const { data, error } = await supabase.functions.invoke("report-error", {
      body: input,
    });

    if (error) {
      throw error;
    }

    return {
      logged: Boolean(data?.logged ?? true),
      id: typeof data?.id === "number" ? data.id : undefined,
    };
  },
};
