import { useUIStore, useAuthStore } from "../store";
import { Button, Card, CardContent, Badge } from "../components/ui";
import { Link } from "@tanstack/react-router";
import {
  useMyHires,
  useNotifications,
  useNotificationsSubscription,
  useUpdateHireStatusMutation,
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

export default function ProfilePage() {
  const { locale } = useUIStore();
  const { user, isAuthenticated, logout } = useAuthStore();
  const isNepali = locale === "ne";
  const hiresQuery = useMyHires(isAuthenticated);
  const notificationsQuery = useNotifications(isAuthenticated);
  const updateHireStatus = useUpdateHireStatusMutation();

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

      <div className="grid grid-cols-2 gap-4">
        <Link to="/profile" className="block" aria-label="View Hires">
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
        </Link>
        <Link to="/profile" className="block" aria-label="View Notifications">
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
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {isNepali ? "भर्खरको" : "Recent"}
          </h2>
          {hiresQuery.isLoading ? (
            <p className="text-sm text-terrain-500">
              {isNepali ? "लोड हुँदै..." : "Loading..."}
            </p>
          ) : hireHistory.length > 0 ? (
            hireHistory.map((hire) => (
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
                  <div className="flex-1">
                    <Link
                      to="/worker/$workerId"
                      params={{ workerId: hire.workerId }}
                      className="font-medium text-sm text-mountain-900 hover:text-crimson-700 transition-colors"
                    >
                      {isNepali ? "कामदार ID" : "Worker ID"}:{" "}
                      {hire.workerId.slice(0, 8)}
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
                  {(hire.status === "pending" ||
                    hire.status === "accepted") && (
                    <div className="flex gap-2">
                      {hire.status === "accepted" && (
                        <Button
                          size="sm"
                          onClick={() => void handleMarkCompleted(hire.id)}
                          disabled={updateHireStatus.isPending}
                        >
                          {isNepali ? "सम्पन्न" : "Complete"}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCancel(hire.id)}
                        disabled={updateHireStatus.isPending}
                      >
                        {isNepali ? "रद्द" : "Cancel"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
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
