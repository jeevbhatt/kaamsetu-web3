import { useUIStore, useAuthStore } from "../store";
import { Button, Card, CardContent, Badge } from "../components/ui";
import { Link } from "@tanstack/react-router";
import {
  useMyHires,
  useNotifications,
  useNotificationsSubscription,
  useUpdateHireStatusMutation,
  useWorker,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useMyWorkerProfile,
  useIncomingHires,
} from "../hooks";
import {
  User,
  Bell,
  Settings,
  LogOut,
  Briefcase,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { HireRecord } from "@shram-sewa/shared";

export default function ProfilePage() {
  const { locale } = useUIStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const isNepali = locale === "ne";
  const hiresQuery = useMyHires(isAuthenticated);
  const notificationsQuery = useNotifications(isAuthenticated);
  const updateHireStatus = useUpdateHireStatusMutation();
  const markRead = useMarkNotificationAsReadMutation();
  const markAllRead = useMarkAllNotificationsAsReadMutation();

  // Worker-side: only fetched when the role is "worker". When the user is
  // a hirer or hasn't completed worker onboarding, the profile query
  // returns null and useIncomingHires no-ops because the id is undefined.
  const isWorker = user?.role === "worker";
  const myWorkerProfile = useMyWorkerProfile(isAuthenticated && isWorker);
  const incomingHires = useIncomingHires(
    myWorkerProfile.data?.id,
    isAuthenticated && isWorker,
  );

  useNotificationsSubscription(isAuthenticated);

  const hireHistory = hiresQuery.data ?? [];
  const activeHires = hireHistory.filter(
    (hire) => hire.status === "pending" || hire.status === "accepted",
  ).length;
  const unreadNotifications =
    notificationsQuery.data?.filter((notification) => !notification.isRead)
      .length ?? 0;

  const formatDate = (date: Date) =>
    date.toLocaleDateString(locale === "ne" ? "ne-NP" : "en-NP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const statusLabel = (status: string) => {
    if (status === "pending") return isNepali ? "पेन्डिङ" : "Pending";
    if (status === "accepted") return isNepali ? "स्वीकृत" : "Accepted";
    if (status === "rejected") return isNepali ? "अस्वीकृत" : "Rejected";
    if (status === "cancelled") return isNepali ? "रद्द" : "Cancelled";
    return isNepali ? "सम्पन्न" : "Completed";
  };

  const statusVariant = (status: string) => {
    if (status === "completed") return "success" as const;
    if (status === "accepted" || status === "pending") {
      return "warning" as const;
    }
    if (status === "rejected" || status === "cancelled") {
      return "destructive" as const;
    }
    return "secondary" as const;
  };

  const handleMarkCompleted = async (hireId: string) => {
    await updateHireStatus.mutateAsync({
      hireId,
      status: "completed",
    });
  };

  const handleCancel = async (hireId: string) => {
    await updateHireStatus.mutateAsync({
      hireId,
      status: "cancelled",
    });
  };

  // Worker-side actions on incoming hire requests. The DB constraint
  // (idx_hire_ip_worker partial unique) prevents duplicate hires, but
  // accept/reject is what actually drives availability — `hires.ts`
  // syncWorkerAvailability flips is_available based on accepted count.
  const handleAccept = async (hireId: string) => {
    await updateHireStatus.mutateAsync({ hireId, status: "accepted" });
  };
  const handleReject = async (hireId: string) => {
    await updateHireStatus.mutateAsync({ hireId, status: "rejected" });
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full bg-terrain-100 flex items-center justify-center mx-auto mb-6">
          <User className="w-10 h-10 text-terrain-500" />
        </div>
        <h1 className="text-2xl font-bold text-mountain-900 mb-2">
          {isNepali ? "लगइन आवश्यक" : "Login Required"}
        </h1>
        <Link to="/login">
          <Button size="lg">{isNepali ? "लगइन" : "Login"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-crimson-100 flex items-center justify-center overflow-hidden shadow-sm border-2 border-white">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user?.fullName || "User"}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    const fallback = (e.target as HTMLImageElement).parentElement?.querySelector(".avatar-fallback");
                    if (fallback) fallback.classList.remove("hidden");
                  }}
                />
              ) : null}
              <span className={`avatar-fallback ${user?.avatarUrl ? "hidden" : ""}`}>
                <User className="w-8 h-8 text-crimson-700" />
              </span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-mountain-900">
                {user?.fullName || "User"}
              </h1>
              <p className="text-terrain-500">{user?.phone}</p>
              <Badge variant="secondary" className="mt-1">
                {user?.role}
              </Badge>
            </div>
            <Button variant="outline" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick-stats cards. The hires + notifications cards anchor-scroll
          to their respective lists below (real interaction, not the old
          self-link stubs). */}
      <div className="grid grid-cols-2 gap-4">
        <a
          href="#hires-list"
          className="block"
          aria-label={isNepali ? "भाडाहरू" : "View Hires"}
        >
          <Card className="cursor-pointer hover:border-crimson-200 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <Briefcase className="w-5 h-5 text-blue-600" />
              <div>
                <div className="font-medium">
                  {isNepali ? "भाडाहरू" : "Hires"}
                </div>
                <div className="text-sm text-terrain-500">
                  {activeHires} {isNepali ? "सक्रिय" : "active"}
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
        <a
          href="#notifications-list"
          className="block"
          aria-label={isNepali ? "सूचना" : "View Notifications"}
        >
          <Card className="cursor-pointer hover:border-crimson-200 h-full">
            <CardContent className="p-4 flex items-center gap-3">
              <Bell className="w-5 h-5 text-amber-600" />
              <div>
                <div className="font-medium">
                  {isNepali ? "सूचना" : "Notifications"}
                </div>
                <div className="text-sm text-terrain-500">
                  {unreadNotifications} {isNepali ? "नयाँ" : "new"}
                </div>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Notifications list — real DOM rendering with mark-as-read.
          Replaces the previous count-only display. */}
      <Card id="notifications-list">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isNepali ? "सूचनाहरू" : "Notifications"}
            </h2>
            {unreadNotifications > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markAllRead.mutateAsync()}
                disabled={markAllRead.isPending}
              >
                {isNepali ? "सबै पढिएको चिन्ह" : "Mark all read"}
              </Button>
            )}
          </div>
          {notificationsQuery.isLoading ? (
            <p className="text-sm text-terrain-500">
              {isNepali ? "लोड हुँदै..." : "Loading..."}
            </p>
          ) : (notificationsQuery.data ?? []).length > 0 ? (
            <ul className="space-y-2">
              {(notificationsQuery.data ?? []).slice(0, 20).map((n) => {
                const title = isNepali && n.titleNp ? n.titleNp : n.title;
                const body = isNepali && n.bodyNp ? n.bodyNp : n.body;
                return (
                  <li
                    key={n.id}
                    onClick={() => {
                      if (!n.isRead) {
                        void markRead.mutateAsync(n.id);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      n.isRead
                        ? "border-terrain-200 bg-white"
                        : "border-crimson-200 bg-crimson-50/40 hover:bg-crimson-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <Bell
                        className={`w-4 h-4 mt-0.5 ${
                          n.isRead ? "text-terrain-400" : "text-crimson-700"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-mountain-900">
                          {title}
                        </div>
                        <div className="text-xs text-terrain-500 truncate">
                          {body}
                        </div>
                        <div className="text-[11px] text-terrain-400 mt-0.5">
                          {formatDate(n.createdAt)}
                        </div>
                      </div>
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-crimson-700 mt-1.5" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-terrain-500">
              {isNepali
                ? "कुनै सूचना उपलब्ध छैन"
                : "No notifications yet"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Worker-side: incoming hire requests. Only renders when the
          logged-in user is a worker. Accept/Reject mutations reuse the
          same useUpdateHireStatusMutation that hirers use to complete/
          cancel, so all status transitions hit the same audited path. */}
      {isWorker && (
        <Card id="incoming-hires-list">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-crimson-700" />
              {isNepali ? "आउँदै गरेका अनुरोध" : "Incoming Hire Requests"}
            </h2>
            {incomingHires.isLoading ? (
              <p className="text-sm text-terrain-500">
                {isNepali ? "लोड हुँदै..." : "Loading..."}
              </p>
            ) : (incomingHires.data ?? []).length > 0 ? (
              (incomingHires.data ?? []).map((hire) => (
                <div
                  key={hire.id}
                  className="rounded-lg bg-terrain-50 mb-3 p-3 space-y-3"
                >
                  <div className="flex items-center gap-4">
                    {hire.status === "completed" ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-mountain-900">
                        {hire.workDescription?.slice(0, 80) ||
                          (isNepali ? "(विवरण छैन)" : "(no description)")}
                      </div>
                      <div className="text-xs text-terrain-500">
                        {formatDate(hire.hiredAt)}
                        {hire.workDate
                          ? ` · ${isNepali ? "काम मिति" : "work date"} ${formatDate(hire.workDate)}`
                          : ""}
                      </div>
                    </div>
                    <Badge variant={statusVariant(hire.status)}>
                      {statusLabel(hire.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">
                      रु {(hire.agreedRateNpr ?? 0).toLocaleString("en-IN")}
                      {hire.workDurationDays > 1
                        ? ` × ${hire.workDurationDays} ${isNepali ? "दिन" : "days"}`
                        : ""}
                    </div>
                    {hire.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleAccept(hire.id)}
                          disabled={updateHireStatus.isPending}
                        >
                          {isNepali ? "स्वीकार" : "Accept"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleReject(hire.id)}
                          disabled={updateHireStatus.isPending}
                        >
                          {isNepali ? "अस्वीकार" : "Reject"}
                        </Button>
                      </div>
                    )}
                    {hire.status === "accepted" && (
                      <Button
                        size="sm"
                        onClick={() => void handleMarkCompleted(hire.id)}
                        disabled={updateHireStatus.isPending}
                      >
                        {isNepali ? "सम्पन्न" : "Mark Completed"}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-terrain-500">
                {isNepali
                  ? "अहिलेसम्म कुनै अनुरोध प्राप्त भएको छैन।"
                  : "No incoming hire requests yet."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card id="hires-list">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isNepali ? "भर्खरको भाडा" : "Recent Hires"}
          </h2>
          {hiresQuery.isLoading ? (
            <p className="text-sm text-terrain-500">
              {isNepali ? "लोड हुँदै..." : "Loading..."}
            </p>
          ) : hireHistory.length > 0 ? (
            hireHistory.map((hire) => (
              <HireHistoryRow
                key={hire.id}
                hire={hire}
                isNepali={isNepali}
                formatDate={formatDate}
                statusLabel={statusLabel}
                statusVariant={statusVariant}
                onComplete={handleMarkCompleted}
                onCancel={handleCancel}
                isPending={updateHireStatus.isPending}
              />
            ))
          ) : (
            <p className="text-sm text-terrain-500">
              {isNepali
                ? "अहिलेसम्म कुनै भाडा इतिहास उपलब्ध छैन"
                : "No hire history available yet"}
            </p>
          )}
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full text-red-600"
        onClick={() => {
          void logout();
        }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        {isNepali ? "लगआउट" : "Logout"}
      </Button>
    </div>
  );
}

// ─── HireHistoryRow ────────────────────────────────────────────────────
// Extracted into its own component so each row can call useWorker(workerId)
// without violating the rules of hooks (no hook calls in loops). Renders
// the worker's real name (with Nepali fallback) instead of "Worker ID: 12345678".
//
// While the worker query is in flight we show the truncated UUID as a
// placeholder so the row layout doesn't reflow when the name resolves.
function HireHistoryRow({
  hire,
  isNepali,
  formatDate,
  statusLabel,
  statusVariant,
  onComplete,
  onCancel,
  isPending,
}: {
  hire: HireRecord;
  isNepali: boolean;
  formatDate: (date: Date) => string;
  statusLabel: (status: string) => string;
  statusVariant: (
    status: string,
  ) => "success" | "warning" | "destructive" | "secondary";
  onComplete: (hireId: string) => Promise<void>;
  onCancel: (hireId: string) => Promise<void>;
  isPending: boolean;
}) {
  const workerQuery = useWorker(hire.workerId);
  const worker = workerQuery.data;

  const displayName = (() => {
    if (worker) {
      if (isNepali && worker.user?.fullNameNp) return worker.user.fullNameNp;
      if (worker.user?.fullName) return worker.user.fullName;
      if (isNepali && worker.fullNameNp) return worker.fullNameNp;
      if (worker.fullName) return worker.fullName;
    }
    // Fallback while loading or on missing-data
    return `${isNepali ? "कामदार" : "Worker"} ${hire.workerId.slice(0, 8)}`;
  })();

  return (
    <div className="rounded-lg bg-terrain-50 mb-3 p-3 space-y-3">
      <div className="flex items-center gap-4">
        {hire.status === "completed" ? (
          <CheckCircle className="w-5 h-5 text-green-600" />
        ) : (
          <Clock className="w-5 h-5 text-amber-600" />
        )}
        <div className="flex-1 min-w-0">
          <Link
            to="/worker/$workerId"
            params={{ workerId: hire.workerId }}
            className="font-medium text-sm text-mountain-900 hover:text-crimson-700 transition-colors truncate block"
          >
            {displayName}
          </Link>
          <div className="text-sm text-terrain-500">
            {formatDate(hire.hiredAt)}
          </div>
        </div>
        <Badge variant={statusVariant(hire.status)}>
          {statusLabel(hire.status)}
        </Badge>
      </div>
      <div className="flex items-center justify-between">
        <div className="font-medium">
          रु {(hire.agreedRateNpr ?? 0).toLocaleString("en-IN")}
        </div>
        {(hire.status === "pending" || hire.status === "accepted") && (
          <div className="flex gap-2">
            {hire.status === "accepted" && (
              <Button
                size="sm"
                onClick={() => void onComplete(hire.id)}
                disabled={isPending}
              >
                {isNepali ? "सम्पन्न" : "Complete"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void onCancel(hire.id)}
              disabled={isPending}
            >
              {isNepali ? "रद्द" : "Cancel"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
