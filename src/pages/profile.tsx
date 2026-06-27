import { useRef, useState } from "react";
import { useUIStore, useAuthStore } from "../store";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  Badge,
} from "../components/ui";
import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
  useMyHires,
  useNotifications,
  useUpdateHireStatusMutation,
  useWorker,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useMyWorkerProfile,
  useIncomingHires,
  useWorkerProfileUpdateMutation,
} from "../hooks";
import {
  User,
  Camera,
  Bell,
  Settings,
  LogOut,
  Briefcase,
  CheckCircle,
  Clock,
  Globe,
  Loader2,
  Power,
  Pencil,
  KeyRound,
  Trash2,
  Star,
  Shield,
  Wallet,
  Users,
} from "lucide-react";
import type { HireRecord } from "@shram-sewa/shared";
import { authApi as sharedAuthApi } from "@shram-sewa/shared";
import { getSupabaseClient, translateError } from "../lib";
import { useToast } from "../components/ToastContainer";

export default function ProfilePage() {
  const { locale, toggleLocale } = useUIStore();
  const { user, isAuthenticated, logout, initialize } = useAuthStore();
  const isNepali = locale === "ne";
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const toast = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [isRoleUpdating, setIsRoleUpdating] = useState(false);
  // Account management (edit name + phone, change password, delete account).
  const [nameDraft, setNameDraft] = useState("");
  const [nameNpDraft, setNameNpDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hiresQuery = useMyHires(isAuthenticated);
  const notificationsQuery = useNotifications(isAuthenticated);
  const updateHireStatus = useUpdateHireStatusMutation();
  const markRead = useMarkNotificationAsReadMutation();
  const markAllRead = useMarkAllNotificationsAsReadMutation();
  const updateWorkerProfile = useWorkerProfileUpdateMutation();

  // Display name with Nepali fallback (matches WorkerCard logic).
  const displayName = (() => {
    if (!user) return "User";
    if (isNepali) return user.fullNameNp || user.fullName || "प्रयोगकर्ता";
    return user.fullName || user.fullNameNp || "User";
  })();

  const roleLabel = (role?: string) => {
    if (role === "worker") return isNepali ? "कामदार" : "Worker";
    if (role === "hirer") return isNepali ? "रोजगारदाता" : "Hirer";
    if (role === "admin") return isNepali ? "प्रशासक" : "Admin";
    return role ?? "";
  };

  // Worker-side: only fetched when the role is "worker". When the user is
  // a hirer or hasn't completed worker onboarding, the profile query
  // returns null and useIncomingHires no-ops because the id is undefined.
  const isWorker = user?.role === "worker";
  const myWorkerProfile = useMyWorkerProfile(isAuthenticated);
  const incomingHires = useIncomingHires(
    myWorkerProfile.data?.id,
    isAuthenticated && isWorker,
  );

  const hireHistory = hiresQuery.data ?? [];
  const activeHires = hireHistory.filter(
    (hire) => hire.status === "pending" || hire.status === "accepted",
  ).length;
  const unreadNotifications =
    notificationsQuery.data?.filter((notification) => !notification.isRead)
      .length ?? 0;

  // ── Dashboard KPIs ──────────────────────────────────────────────────
  // Counts and earnings are derived from hire_records (the source of truth
  // the update_worker_stats trigger also reads) rather than trusting cached
  // counter columns, so the strip can never drift out of sync with the lists
  // rendered below it. Worker numbers come from incoming requests; hirer
  // numbers from their own hire history.
  const nprFormat = (amount: number) =>
    `रु ${Math.round(amount).toLocaleString("en-IN")}`;

  const incomingHireRows = incomingHires.data ?? [];
  const workerPending = incomingHireRows.filter(
    (h) => h.status === "pending",
  ).length;
  const workerCompleted = incomingHireRows.filter(
    (h) => h.status === "completed",
  );
  const workerEarnings = workerCompleted.reduce(
    (sum, h) => sum + (h.agreedRateNpr ?? 0) * (h.workDurationDays || 1),
    0,
  );

  const hirerCompleted = hireHistory.filter((h) => h.status === "completed");
  const hirerSpent = hirerCompleted.reduce(
    (sum, h) => sum + (h.agreedRateNpr ?? 0) * (h.workDurationDays || 1),
    0,
  );
  const hirerWorkers = new Set(hireHistory.map((h) => h.workerId)).size;

  type Kpi = {
    icon: typeof Briefcase;
    label: string;
    value: string | number;
    sub?: string;
    color: string;
    href: string;
  };

  const kpis: Kpi[] =
    isWorker && myWorkerProfile.data
      ? [
          {
            icon: Clock,
            label: isNepali ? "नयाँ अनुरोध" : "New requests",
            value: workerPending,
            color: "text-crimson-700",
            href: "#incoming-hires-list",
          },
          {
            icon: CheckCircle,
            label: isNepali ? "सम्पन्न काम" : "Jobs done",
            value: workerCompleted.length,
            color: "text-emerald-600",
            href: "#incoming-hires-list",
          },
          {
            icon: Star,
            label: isNepali ? "रेटिङ" : "Rating",
            value:
              myWorkerProfile.data.avgRating > 0
                ? myWorkerProfile.data.avgRating.toFixed(1)
                : "—",
            sub: `(${myWorkerProfile.data.totalReviews})`,
            color: "text-gold-500 fill-current",
            href: "#incoming-hires-list",
          },
          {
            icon: Wallet,
            label: isNepali ? "अनुमानित आम्दानी" : "Est. earnings",
            value: nprFormat(workerEarnings),
            color: "text-mountain-700",
            href: "#incoming-hires-list",
          },
        ]
      : [
          {
            icon: Briefcase,
            label: isNepali ? "सक्रिय भाडा" : "Active hires",
            value: activeHires,
            color: "text-blue-600",
            href: "#hires-list",
          },
          {
            icon: CheckCircle,
            label: isNepali ? "सम्पन्न" : "Completed",
            value: hirerCompleted.length,
            color: "text-emerald-600",
            href: "#hires-list",
          },
          {
            icon: Wallet,
            label: isNepali ? "कुल खर्च" : "Total spent",
            value: nprFormat(hirerSpent),
            color: "text-mountain-700",
            href: "#hires-list",
          },
          {
            icon: Users,
            label: isNepali ? "भाडामा लिएका कामदार" : "Workers hired",
            value: hirerWorkers,
            color: "text-crimson-700",
            href: "#hires-list",
          },
        ];

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

  const syncUserProfile = async (
    metadataPatch: Record<string, string | null>,
    publicPatch: Record<string, string | null>,
  ) => {
    if (!user?.id) return;
    const supabase = getSupabaseClient();
    await sharedAuthApi.updateUser({
      data: {
        full_name: user.fullName || null,
        full_name_np: user.fullNameNp || null,
        role: user.role,
        avatar_url: user.avatarUrl || null,
        ...metadataPatch,
      },
    });
    const { error } = await (supabase as any)
      .from("users")
      .update({
        ...publicPatch,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", user.id);
    if (error) throw error;
    await initialize();
  };

  const handleAvatarFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !user?.id) return;

    setAvatarMessage(null);
    setAvatarError(null);

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      const message =
        isNepali
          ? "JPG, PNG वा WebP फोटो मात्र प्रयोग गर्नुहोस्।"
          : "Use a JPG, PNG, or WebP image.";
      setAvatarError(message);
      toast.warning(
        isNepali ? "फोटो स्वीकार भएन" : "Image not accepted",
        message,
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const message =
        isNepali
          ? "फोटो ५MB भन्दा सानो हुनुपर्छ।"
          : "Profile image must be smaller than 5MB.";
      setAvatarError(message);
      toast.warning(
        isNepali ? "फोटो धेरै ठूलो छ" : "Image is too large",
        message,
      );
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
    setIsAvatarUploading(true);

    try {
      const supabase = getSupabaseClient();
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      await syncUserProfile(
        { avatar_url: avatarUrl },
        { avatar_url: avatarUrl },
      );
      const message = isNepali
        ? "प्रोफाइल फोटो अपडेट भयो।"
        : "Profile photo updated.";
      setAvatarMessage(message);
      toast.success(
        isNepali ? "फोटो अपडेट भयो" : "Photo updated",
        message,
      );
    } catch (error) {
      setAvatarPreview(null);
      const message = translateError(error, { isNepali, context: "profile" });
      setAvatarError(message);
      toast.error(
        isNepali ? "फोटो अपलोड भएन" : "Photo upload failed",
        message,
      );
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleRoleSwitch = async (nextRole: "hirer" | "worker") => {
    if (!user || nextRole === user.role) return;
    setRoleMessage(null);
    setRoleError(null);

    if (nextRole === "worker" && !myWorkerProfile.data) {
      window.location.href = "/onboarding?role=worker";
      return;
    }

    setIsRoleUpdating(true);
    try {
      await syncUserProfile({ role: nextRole }, { role: nextRole });
      const message =
        nextRole === "worker"
          ? isNepali
            ? "कामदार मोड सक्रिय भयो।"
            : "Worker mode is active."
          : isNepali
            ? "रोजगारदाता मोड सक्रिय भयो।"
            : "Hirer mode is active.";
      setRoleMessage(message);
      toast.success(
        isNepali ? "खाता प्रकार बदलियो" : "Account type updated",
        message,
      );
    } catch (error) {
      const message = translateError(error, { isNepali, context: "profile" });
      setRoleError(message);
      toast.error(
        isNepali ? "खाता प्रकार बदल्न सकिएन" : "Account type not updated",
        message,
      );
    } finally {
      setIsRoleUpdating(false);
    }
  };

  const handleSaveName = async () => {
    setIsSavingName(true);
    try {
      const trimmedPhone = phoneDraft.trim();
      await syncUserProfile(
        { full_name: nameDraft || null, full_name_np: nameNpDraft || null },
        {
          full_name: nameDraft || null,
          full_name_np: nameNpDraft || null,
          phone: trimmedPhone || null,
        },
      );
      setIsEditingName(false);
      toast.success(
        isNepali ? "नाम अपडेट भयो" : "Name updated",
        "",
      );
    } catch (error) {
      toast.error(
        isNepali ? "नाम अपडेट भएन" : "Name not updated",
        translateError(error, { isNepali, context: "profile" }),
      );
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.warning(
        isNepali ? "पासवर्ड छोटो छ" : "Password too short",
        isNepali ? "कम्तीमा ६ अक्षर" : "At least 6 characters",
      );
      return;
    }
    setIsSavingPassword(true);
    try {
      await sharedAuthApi.updatePassword(newPassword);
      setNewPassword("");
      toast.success(
        isNepali ? "पासवर्ड अपडेट भयो" : "Password updated",
        "",
      );
    } catch (error) {
      toast.error(
        isNepali ? "पासवर्ड अपडेट भएन" : "Password not updated",
        translateError(error, { isNepali, context: "profile" }),
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      isNepali
        ? "तपाईंको खाता स्थायी रूपमा मेटिनेछ। यो पूर्ववत गर्न मिल्दैन। पक्का?"
        : "Your account will be permanently deleted. This cannot be undone. Continue?",
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await sharedAuthApi.deleteAccount();
      await logout();
      window.location.href = "/";
    } catch (error) {
      toast.error(
        isNepali ? "खाता मेटिएन" : "Account not deleted",
        translateError(error, { isNepali, context: "profile" }),
      );
      setIsDeleting(false);
    }
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
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-white bg-crimson-100 shadow-sm">
                {avatarPreview || user?.avatarUrl ? (
                  <AvatarImage
                    src={avatarPreview ?? user?.avatarUrl}
                    alt={user?.fullName || "User"}
                  />
                ) : null}
                <AvatarFallback>
                  <User className="w-8 h-8 text-crimson-700" />
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-mountain-700 text-white shadow-sm hover:bg-mountain-900 disabled:opacity-70"
                onClick={() => avatarInputRef.current?.click()}
                disabled={isAvatarUploading}
                aria-label={
                  isNepali ? "प्रोफाइल फोटो बदल्नुहोस्" : "Change profile photo"
                }
              >
                {isAvatarUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarFile}
              />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-mountain-900">
                {displayName}
              </h1>
              <p className="text-terrain-500">{user?.phone}</p>
              <Badge variant="secondary" className="mt-1">
                {roleLabel(user?.role)}
              </Badge>
              {avatarMessage && (
                <p className="mt-1 text-xs text-emerald-700">{avatarMessage}</p>
              )}
              {avatarError && (
                <p className="mt-1 text-xs text-red-600">{avatarError}</p>
              )}
            </div>
            <a href="#settings" aria-label={isNepali ? "सेटिङ" : "Settings"}>
              <Button variant="outline" size="icon">
                <Settings className="w-5 h-5" />
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
      </motion.div>

      {/* Dashboard KPI strip — role-specific glance metrics. Each card
          anchor-scrolls to the list it summarises, so the numbers are a
          live entry point into the data, not decoration. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <a
              key={kpi.label}
              href={kpi.href}
              className="block"
              aria-label={kpi.label}
            >
              <Card className="cursor-pointer hover:border-crimson-200 h-full">
                <CardContent className="p-4">
                  <Icon className={`w-5 h-5 ${kpi.color}`} />
                  <div className="mt-2 text-xl font-bold text-mountain-900 leading-tight">
                    {kpi.value}
                    {kpi.sub && (
                      <span className="ml-1 text-xs font-normal text-terrain-500">
                        {kpi.sub}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-terrain-500">
                    {kpi.label}
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>

      {/* Notifications quick-access — kept for both roles below the KPIs. */}
      <a
        href="#notifications-list"
        className="block"
        aria-label={isNepali ? "सूचना" : "View Notifications"}
      >
        <Card className="cursor-pointer hover:border-crimson-200">
          <CardContent className="p-4 flex items-center gap-3">
            <Bell className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <div className="font-medium">
                {isNepali ? "सूचना" : "Notifications"}
              </div>
              <div className="text-sm text-terrain-500">
                {unreadNotifications} {isNepali ? "नयाँ" : "new"}
              </div>
            </div>
            {unreadNotifications > 0 && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-crimson-700 px-2 text-xs font-semibold text-white">
                {unreadNotifications}
              </span>
            )}
          </CardContent>
        </Card>
      </a>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ delay: reduceMotion ? 0 : 0.04, duration: 0.18, ease: "easeOut" }}
      >
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-mountain-900">
                {isNepali ? "खाता प्रकार" : "Account type"}
              </h2>
              <p className="mt-1 text-sm text-terrain-500">
                {isNepali
                  ? "रोजगारदाता भएर कामदार खोज्नुहोस् वा कामदार भएर अनुरोध लिनुहोस्।"
                  : "Hire workers as a hirer, or receive requests as a worker."}
              </p>
            </div>
            {isRoleUpdating && (
              <Loader2 className="mt-1 h-5 w-5 animate-spin text-crimson-700" />
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void handleRoleSwitch("hirer")}
              disabled={isRoleUpdating || user?.role === "hirer"}
              className={`rounded-lg border p-4 text-left transition-colors ${
                user?.role === "hirer"
                  ? "border-crimson-300 bg-crimson-50"
                  : "border-terrain-200 bg-white hover:border-crimson-200"
              } disabled:cursor-default`}
            >
              <User className="mb-3 h-6 w-6 text-crimson-700" />
              <div className="font-semibold text-mountain-900">
                {isNepali ? "रोजगारदाता" : "Hirer"}
              </div>
              <div className="mt-1 text-sm text-terrain-500">
                {isNepali ? "कामदार खोज्ने र भाडामा लिने" : "Find and hire workers"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleRoleSwitch("worker")}
              disabled={isRoleUpdating || user?.role === "worker" || myWorkerProfile.isLoading}
              className={`rounded-lg border p-4 text-left transition-colors ${
                user?.role === "worker"
                  ? "border-crimson-300 bg-crimson-50"
                  : "border-terrain-200 bg-white hover:border-crimson-200"
              } disabled:cursor-default disabled:opacity-75`}
            >
              <Briefcase className="mb-3 h-6 w-6 text-crimson-700" />
              <div className="font-semibold text-mountain-900">
                {isNepali ? "कामदार" : "Worker"}
              </div>
              <div className="mt-1 text-sm text-terrain-500">
                {myWorkerProfile.data
                  ? isNepali
                    ? "काम अनुरोध प्राप्त गर्ने"
                    : "Receive work requests"
                  : isNepali
                    ? "कामदार प्रोफाइल सेटअप गर्नुहोस्"
                    : "Set up a worker profile"}
              </div>
            </button>
          </div>
          {roleMessage && (
            <p className="mt-3 text-sm text-emerald-700">{roleMessage}</p>
          )}
          {roleError && <p className="mt-3 text-sm text-red-600">{roleError}</p>}
        </CardContent>
      </Card>
      </motion.div>

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
                      // Granular drill-down: a hire-related notification opens
                      // the full request detail page.
                      if (n.hireId) {
                        void navigate({
                          to: "/hires/$hireId",
                          params: { hireId: n.hireId },
                        });
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
              {isNepali ? "कुनै सूचना उपलब्ध छैन" : "No notifications yet"}
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
                      <Link
                        to="/hires/$hireId"
                        params={{ hireId: hire.id }}
                        className="font-medium text-sm text-mountain-900 hover:text-crimson-700 transition-colors block truncate"
                      >
                        {hire.workDescription?.slice(0, 80) ||
                          (isNepali ? "(विवरण छैन)" : "(no description)")}
                      </Link>
                      <div className="text-xs text-terrain-500">
                        {formatDate(hire.hiredAt)}
                        {hire.workDate
                          ? ` · ${isNepali ? "काम मिति" : "work date"} ${formatDate(hire.workDate)}`
                          : ""}
                      </div>
                      <Link
                        to="/hires/$hireId"
                        params={{ hireId: hire.id }}
                        className="text-xs text-crimson-700 hover:underline"
                      >
                        {isNepali ? "विवरण हेर्नुहोस् →" : "View details →"}
                      </Link>
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
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-terrain-100">
                <Briefcase className="h-6 w-6 text-terrain-500" />
              </div>
              <p className="text-sm text-terrain-500">
                {isNepali
                  ? "अहिलेसम्म कुनै भाडा इतिहास उपलब्ध छैन"
                  : "No hire history available yet"}
              </p>
              <Link to="/search" className="mt-3 inline-block">
                <Button size="sm">
                  {isNepali ? "कामदार खोज्नुहोस्" : "Find workers"}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Settings ── reachable from the header gear (anchor #settings) */}
      <Card id="settings" className="scroll-mt-20">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-mountain-700" />
            {isNepali ? "सेटिङ" : "Settings"}
          </h2>

          <div className="divide-y divide-terrain-200">
            {/* Admin console — only for admins; gives mobile-web admins a way
                in (the desktop hover menu isn't available on small screens). */}
            {user?.role === "admin" && (
              <Link to="/admin" className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-crimson-700" />
                  <div>
                    <div className="font-medium text-mountain-900">
                      {isNepali ? "एडमिन कन्सोल" : "Admin console"}
                    </div>
                    <div className="text-sm text-terrain-500">
                      {isNepali
                        ? "प्रयोगकर्ता, कामदार र भाडा व्यवस्थापन"
                        : "Manage users, workers & hires"}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  {isNepali ? "खोल्नुहोस्" : "Open"}
                </Button>
              </Link>
            )}

            {/* Language */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-crimson-700" />
                <div>
                  <div className="font-medium text-mountain-900">
                    {isNepali ? "भाषा" : "Language"}
                  </div>
                  <div className="text-sm text-terrain-500">
                    {isNepali ? "नेपाली" : "English"}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleLocale}>
                {isNepali ? "Switch to English" : "नेपालीमा बदल्नुहोस्"}
              </Button>
            </div>

            {/* Worker availability toggle */}
            {isWorker && myWorkerProfile.data && (
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <Power
                    className={`w-5 h-5 ${
                      myWorkerProfile.data.isAvailable
                        ? "text-emerald-600"
                        : "text-terrain-400"
                    }`}
                  />
                  <div>
                    <div className="font-medium text-mountain-900">
                      {isNepali ? "काम उपलब्धता" : "Work availability"}
                    </div>
                    <div className="text-sm text-terrain-500">
                      {myWorkerProfile.data.isAvailable
                        ? isNepali
                          ? "तपाईं अहिले उपलब्ध हुनुहुन्छ"
                          : "You're currently available"
                        : isNepali
                          ? "तपाईं अहिले अनुपलब्ध हुनुहुन्छ"
                          : "You're currently unavailable"}
                    </div>
                  </div>
                </div>
                <Button
                  variant={
                    myWorkerProfile.data.isAvailable ? "outline" : "default"
                  }
                  size="sm"
                  disabled={updateWorkerProfile.isPending}
                  onClick={() => {
                    const profile = myWorkerProfile.data;
                    if (!profile) return;
                    void updateWorkerProfile.mutateAsync({
                      profileId: profile.id,
                      patch: { isAvailable: !profile.isAvailable },
                    });
                  }}
                >
                  {myWorkerProfile.data.isAvailable
                    ? isNepali
                      ? "अनुपलब्ध गर्नुहोस्"
                      : "Go unavailable"
                    : isNepali
                      ? "उपलब्ध गर्नुहोस्"
                      : "Go available"}
                </Button>
              </div>
            )}

            {/* Edit profile name */}
            <div className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pencil className="w-5 h-5 text-mountain-700" />
                  <div className="font-medium text-mountain-900">
                    {isNepali ? "प्रोफाइल सम्पादन" : "Edit profile"}
                  </div>
                </div>
                {!isEditingName && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNameDraft(user?.fullName ?? "");
                      setNameNpDraft(user?.fullNameNp ?? "");
                      setPhoneDraft(user?.phone ?? "");
                      setIsEditingName(true);
                    }}
                  >
                    {isNepali ? "सम्पादन" : "Edit"}
                  </Button>
                )}
              </div>
              {isEditingName && (
                <div className="mt-3 space-y-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder={isNepali ? "नाम (अंग्रेजी)" : "Name (English)"}
                    className="w-full h-10 rounded-md border border-terrain-300 px-3 text-sm"
                  />
                  <input
                    value={nameNpDraft}
                    onChange={(e) => setNameNpDraft(e.target.value)}
                    placeholder={isNepali ? "नाम (नेपाली)" : "Name (Nepali)"}
                    className="w-full h-10 rounded-md border border-terrain-300 px-3 text-sm"
                  />
                  <input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder={isNepali ? "फोन नम्बर" : "Phone number"}
                    inputMode="tel"
                    autoComplete="tel"
                    className="w-full h-10 rounded-md border border-terrain-300 px-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleSaveName()} disabled={isSavingName}>
                      {isSavingName ? "..." : isNepali ? "सेभ" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditingName(false)}
                      disabled={isSavingName}
                    >
                      {isNepali ? "रद्द" : "Cancel"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Change / set password */}
            <div className="py-3">
              <div className="flex items-center gap-3 mb-2">
                <KeyRound className="w-5 h-5 text-mountain-700" />
                <div>
                  <div className="font-medium text-mountain-900">
                    {isNepali ? "पासवर्ड बदल्नुहोस्" : "Change password"}
                  </div>
                  <div className="text-sm text-terrain-500">
                    {isNepali
                      ? "इमेल लगइनको लागि नयाँ पासवर्ड सेट गर्नुहोस्"
                      : "Set a new password for email sign-in"}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isNepali ? "नयाँ पासवर्ड" : "New password"}
                  autoComplete="new-password"
                  className="flex-1 h-10 rounded-md border border-terrain-300 px-3 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => void handleChangePassword()}
                  disabled={isSavingPassword || !newPassword}
                >
                  {isSavingPassword ? "..." : isNepali ? "अपडेट" : "Update"}
                </Button>
              </div>
            </div>

            {/* Logout */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-red-600" />
                <div className="font-medium text-mountain-900">
                  {isNepali ? "लगआउट" : "Logout"}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={() => {
                  void logout();
                }}
              >
                {isNepali ? "लगआउट" : "Logout"}
              </Button>
            </div>

            {/* Delete account (destructive, permanent) */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-700">
                    {isNepali ? "खाता मेटाउनुहोस्" : "Delete account"}
                  </div>
                  <div className="text-sm text-terrain-500">
                    {isNepali
                      ? "स्थायी रूपमा हटाइन्छ, पूर्ववत हुँदैन"
                      : "Permanent and cannot be undone"}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300"
                onClick={() => void handleDeleteAccount()}
                disabled={isDeleting}
              >
                {isDeleting ? "..." : isNepali ? "मेटाउनुहोस्" : "Delete"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
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
          <Link
            to="/hires/$hireId"
            params={{ hireId: hire.id }}
            className="text-xs text-crimson-700 hover:underline"
          >
            {isNepali ? "विवरण हेर्नुहोस् →" : "View details →"}
          </Link>
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
