import { getSupabase } from "./client";
import type { Database } from "./database.types";
import type { PushPlatform } from "../types";

export interface RegisterPushTokenInput {
  token: string;
  platform: PushPlatform;
}

export interface DispatchHireNotificationResult {
  notificationId?: string;
  workerUserId?: string;
  sentCount: number;
  invalidTokenCount: number;
}

type PushTokenRow = Database["public"]["Tables"]["push_tokens"]["Row"];

export const pushTokensApi = {
  async register(input: RegisterPushTokenInput): Promise<PushTokenRow> {
    const supabase = getSupabase();
    const token = input.token.trim();

    if (!token) {
      throw new Error("Push token is required.");
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const userId = userData.user?.id;
    if (!userId) {
      throw new Error("Authentication is required to register push tokens.");
    }

    const payload: Database["public"]["Tables"]["push_tokens"]["Insert"] = {
      user_id: userId,
      token,
      platform: input.platform,
      is_active: true,
    };

    const { data, error } = await (supabase as any)
      .from("push_tokens")
      .upsert(payload as any, { onConflict: "user_id,token" })
      .select("*")
      .single();

    if (error) throw error;
    return data as PushTokenRow;
  },

  async deactivate(token: string): Promise<void> {
    const supabase = getSupabase();
    const normalizedToken = token.trim();

    if (!normalizedToken) {
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const userId = userData.user?.id;
    if (!userId) {
      return;
    }

    const { error } = await (supabase as any)
      .from("push_tokens")
      .update({ is_active: false } as any)
      .eq("user_id", userId)
      .eq("token", normalizedToken);

    if (error) throw error;
  },
};

export const notificationsApi = {
  async dispatchHireRequest(
    hireId: string,
  ): Promise<DispatchHireNotificationResult> {
    const supabase = getSupabase();

    const { data, error } = await supabase.functions.invoke(
      "send-notification",
      {
        body: {
          event: "hire_request",
          hireId,
        },
      },
    );

    if (error) throw error;

    return {
      notificationId: data?.notificationId,
      workerUserId: data?.workerUserId,
      sentCount: Number(data?.sentCount ?? 0),
      invalidTokenCount: Number(data?.invalidTokenCount ?? 0),
    };
  },

  // Mark a single notification as read. RLS policy "notif_update_own"
  // (20260101000001_rls_policies.sql) restricts this to the notification
  // owner — there's no path for a user to mark someone else's row.
  async markAsRead(notificationId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await (supabase as any)
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("id", notificationId);
    if (error) throw error;
  },

  // Mark every unread notification for the current user as read.
  // We resolve the user from the session rather than trusting a caller
  // argument — same as the API does elsewhere.
  async markAllAsRead(): Promise<void> {
    const supabase = getSupabase();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    const userId = userData.user?.id;
    if (!userId) {
      throw new Error("Authentication is required to mark notifications.");
    }

    const { error } = await (supabase as any)
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
  },
};
