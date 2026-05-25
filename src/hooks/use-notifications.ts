import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@shram-sewa/shared";
import { notificationsApi } from "@shram-sewa/shared/api";
import { queryKeys } from "../lib/query-client";
import { getSupabaseClient, isSupabaseConfigured } from "../lib";
import { useAuthStore } from "../store/auth-store";

export function useNotifications(enabled = true) {
  const userId = useAuthStore((state) => state.user?.id);
  const backendReady = enabled && !!userId && isSupabaseConfigured();
  const notificationsKey = queryKeys.notifications.all(userId ?? "anonymous");

  return useQuery({
    queryKey: notificationsKey,
    enabled: backendReady,
    queryFn: async () => {
      if (!userId) {
        return [] as Notification[];
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("notifications")
        .select(
          "id,user_id,hire_id,type,title,title_np,body,body_np,is_read,push_sent,created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = (data ?? []) as Array<{
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
        created_at: string;
      }>;

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        hireId: row.hire_id ?? undefined,
        type: row.type,
        title: row.title,
        titleNp: row.title_np ?? undefined,
        body: row.body,
        bodyNp: row.body_np ?? undefined,
        isRead: row.is_read,
        pushSent: row.push_sent,
        createdAt: new Date(row.created_at),
      })) as Notification[];
    },
    staleTime: 45 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useNotificationsSubscription(enabled = true) {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!enabled || !userId || !isSupabaseConfigured()) {
      return;
    }

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.all(userId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.unread(userId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient]);
}

// Mark a single notification as read. Optimistic so the badge count
// drops immediately; on failure React Query refetches the canonical
// list and the badge restores.
export function useMarkNotificationAsReadMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const queryKey = queryKeys.notifications.all(userId ?? "anonymous");

  return useMutation({
    mutationFn: (notificationId: string) =>
      notificationsApi.markAsRead(notificationId),
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Notification[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<Notification[]>(
          queryKey,
          previous.map((n) =>
            n.id === notificationId ? { ...n, isRead: true } : n,
          ),
        );
      }
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Mark every unread notification for the current user as read in a
// single round trip. Useful as a "Mark all read" affordance.
export function useMarkAllNotificationsAsReadMutation() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const queryKey = queryKeys.notifications.all(userId ?? "anonymous");

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Notification[]>(queryKey);
      if (previous) {
        queryClient.setQueryData<Notification[]>(
          queryKey,
          previous.map((n) => ({ ...n, isRead: true })),
        );
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
