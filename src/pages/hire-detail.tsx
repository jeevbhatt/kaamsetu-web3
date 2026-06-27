import { useState } from "react";
import { useParams, Link, useNavigate } from "@tanstack/react-router";
import { useUIStore } from "../store";
import { useAuthStore } from "../store/auth-store";
import { Button, Card, CardContent, Badge } from "../components/ui";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Briefcase,
  Clock,
  CheckCircle,
  Coins,
  Star,
} from "lucide-react";
import {
  useHireRecord,
  useUpdateHireStatusMutation,
  useSubmitHireReviewMutation,
  useWorker,
  useLocalUnits,
} from "../hooks";
import { provinces, districts } from "@shram-sewa/shared";
import { isSupabaseConfigured, translateError } from "../lib";
import { useToast } from "../components/ToastContainer";

export default function HireDetailPage() {
  const { hireId } = useParams({ from: "/hires/$hireId" });
  const { locale } = useUIStore();
  const { user, isAuthenticated } = useAuthStore();
  const isNepali = locale === "ne";
  const navigate = useNavigate();
  const toast = useToast();
  const backendConfigured = isSupabaseConfigured();

  const hireQuery = useHireRecord(hireId, isAuthenticated && backendConfigured);
  const updateStatus = useUpdateHireStatusMutation();
  const submitReview = useSubmitHireReviewMutation();
  const [ratingDraft, setRatingDraft] = useState(0);
  const [reviewDraft, setReviewDraft] = useState("");
  const hire = hireQuery.data;
  const workerQuery = useWorker(hire?.workerId ?? "", !!hire?.workerId);
  const localUnitsQuery = useLocalUnits(hire?.hireDistrictId);

  const formatDate = (date?: Date) =>
    date
      ? date.toLocaleDateString(isNepali ? "ne-NP" : "en-NP", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";

  const statusLabel = (status: string) => {
    if (status === "pending") return isNepali ? "पेन्डिङ" : "Pending";
    if (status === "accepted") return isNepali ? "स्वीकृत" : "Accepted";
    if (status === "rejected") return isNepali ? "अस्वीकृत" : "Rejected";
    if (status === "cancelled") return isNepali ? "रद्द" : "Cancelled";
    return isNepali ? "सम्पन्न" : "Completed";
  };
  const statusVariant = (status: string) => {
    if (status === "completed") return "success" as const;
    if (status === "accepted" || status === "pending") return "warning" as const;
    return "destructive" as const;
  };

  const runUpdate = async (
    status: "accepted" | "rejected" | "completed" | "cancelled",
  ) => {
    try {
      await updateStatus.mutateAsync({ hireId, status });
      toast.success(
        isNepali ? "अपडेट भयो" : "Updated",
        isNepali ? "स्थिति अपडेट भयो।" : "Status updated.",
      );
    } catch (error) {
      toast.error(
        isNepali ? "अपडेट भएन" : "Update failed",
        translateError(error, { isNepali, context: "hire" }),
      );
    }
  };

  const handleSubmitReview = async () => {
    if (ratingDraft < 1) return;
    try {
      await submitReview.mutateAsync({
        hireId,
        rating: ratingDraft,
        reviewText: reviewDraft.trim() || undefined,
      });
      toast.success(
        isNepali ? "समीक्षा पेश भयो" : "Review submitted",
        isNepali
          ? "तपाईंको मूल्याङ्कनका लागि धन्यवाद।"
          : "Thanks for rating this worker.",
      );
    } catch (error) {
      toast.error(
        isNepali ? "समीक्षा पेश भएन" : "Review failed",
        translateError(error, { isNepali, context: "hire" }),
      );
    }
  };

  const backLink = (
    <Link
      to="/profile"
      className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
    >
      <ArrowLeft className="w-4 h-4" />
      {isNepali ? "ड्यासबोर्डमा फर्कनुहोस्" : "Back to dashboard"}
    </Link>
  );

  if (!isAuthenticated) {
    navigate({ to: "/login" });
    return null;
  }

  if (hireQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crimson-700" />
      </div>
    );
  }

  if (hireQuery.error || !hire) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {backLink}
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold text-mountain-900 mb-2">
              {isNepali ? "अनुरोध भेटिएन" : "Request not found"}
            </h2>
            <p className="text-terrain-500">
              {isNepali
                ? "यो भाडा अनुरोध उपलब्ध छैन वा हटाइएको छ।"
                : "This hire request is unavailable or was removed."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amIHirer = user?.id === hire.hirerId;
  const worker = workerQuery.data;
  const workerName = worker
    ? isNepali
      ? worker.user?.fullNameNp || worker.user?.fullName || worker.fullName
      : worker.user?.fullName || worker.fullName
    : `${isNepali ? "कामदार" : "Worker"} ${hire.workerId.slice(0, 8)}`;

  const provinceName = (() => {
    const p = provinces.find((x) => x.id === hire.hireProvinceId);
    return p ? (isNepali ? p.nameNp : p.nameEn) : null;
  })();
  const districtName = (() => {
    const d = districts.find((x) => x.id === hire.hireDistrictId);
    return d ? (isNepali ? d.nameNp : d.nameEn) : null;
  })();
  const localUnitName = (() => {
    const u = (localUnitsQuery.data || []).find(
      (x: { id: number }) => x.id === hire.hireLocalUnitId,
    ) as { name_en: string; name_np?: string | null } | undefined;
    return u ? (isNepali ? u.name_np ?? u.name_en : u.name_en) : null;
  })();
  const locationParts = [localUnitName, districtName, provinceName].filter(
    Boolean,
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {backLink}

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-mountain-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-crimson-700" />
                {isNepali ? "भाडा अनुरोध" : "Hire Request"}
              </h1>
              <Link
                to="/worker/$workerId"
                params={{ workerId: hire.workerId }}
                className="text-sm text-terrain-500 hover:text-crimson-700"
              >
                {workerName}
              </Link>
            </div>
            <Badge variant={statusVariant(hire.status)}>
              {statusLabel(hire.status)}
            </Badge>
          </div>

          <div className="rounded-lg bg-terrain-50 p-4">
            <div className="text-xs font-medium text-terrain-500 mb-1">
              {isNepali ? "कामको विवरण" : "What's needed"}
            </div>
            <p className="text-mountain-900 whitespace-pre-wrap">
              {hire.workDescription ||
                (isNepali ? "(विवरण दिइएको छैन)" : "(no description provided)")}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-terrain-500 mt-0.5" />
              <div>
                <div className="text-terrain-500">
                  {isNepali ? "काम मिति" : "Work date"}
                </div>
                <div className="font-medium text-mountain-900">
                  {formatDate(hire.workDate)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-terrain-500 mt-0.5" />
              <div>
                <div className="text-terrain-500">
                  {isNepali ? "अवधि" : "Duration"}
                </div>
                <div className="font-medium text-mountain-900">
                  {hire.workDurationDays}{" "}
                  {isNepali ? "दिन" : hire.workDurationDays === 1 ? "day" : "days"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Coins className="w-4 h-4 text-terrain-500 mt-0.5" />
              <div>
                <div className="text-terrain-500">
                  {isNepali ? "दैनिक दर" : "Daily rate"}
                </div>
                <div className="font-medium text-mountain-900">
                  {hire.agreedRateNpr
                    ? `रु ${hire.agreedRateNpr.toLocaleString("en-IN")}`
                    : isNepali
                      ? "कामदारसँग छलफल"
                      : "To be agreed"}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-terrain-500 mt-0.5" />
              <div>
                <div className="text-terrain-500">
                  {isNepali ? "स्थान" : "Location"}
                </div>
                <div className="font-medium text-mountain-900">
                  {locationParts.length > 0
                    ? locationParts.join(", ")
                    : isNepali
                      ? "तोकिएको छैन"
                      : "Not specified"}
                </div>
              </div>
            </div>
          </div>

          <div className="text-xs text-terrain-400">
            {isNepali ? "अनुरोध मिति" : "Requested"} {formatDate(hire.hiredAt)}
          </div>

          {/* Actions depend on the viewer's side + the current status. */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-terrain-200">
            {hire.status === "pending" && !amIHirer && (
              <>
                <Button
                  onClick={() => void runUpdate("accepted")}
                  disabled={updateStatus.isPending}
                >
                  {isNepali ? "स्वीकार गर्नुहोस्" : "Accept"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void runUpdate("rejected")}
                  disabled={updateStatus.isPending}
                >
                  {isNepali ? "अस्वीकार" : "Reject"}
                </Button>
              </>
            )}
            {hire.status === "accepted" && (
              <Button
                onClick={() => void runUpdate("completed")}
                disabled={updateStatus.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                {isNepali ? "सम्पन्न भयो" : "Mark completed"}
              </Button>
            )}
            {amIHirer &&
              (hire.status === "pending" || hire.status === "accepted") && (
                <Button
                  variant="outline"
                  onClick={() => void runUpdate("cancelled")}
                  disabled={updateStatus.isPending}
                  className="text-red-600"
                >
                  {isNepali ? "रद्द गर्नुहोस्" : "Cancel request"}
                </Button>
              )}
            {(hire.status === "rejected" || hire.status === "cancelled") && (
              <p className="text-sm text-terrain-500">
                {isNepali
                  ? "यो अनुरोध बन्द भइसकेको छ।"
                  : "This request is closed."}
              </p>
            )}
          </div>

          {/* ── Review ── available once the hire is completed. The hirer who
              hasn't rated yet sees the form; both parties (who can read this
              hire under RLS) see a submitted review. Submitting fires the
              update_worker_stats trigger, so the worker's rating populates. */}
          {hire.status === "completed" && (
            <div className="space-y-3 border-t border-terrain-200 pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-mountain-900">
                <Star className="h-4 w-4 text-gold-500" />
                {isNepali ? "समीक्षा" : "Review"}
              </h3>

              {hire.rating != null ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-5 w-5 ${
                          n <= (hire.rating ?? 0)
                            ? "text-gold-500 fill-current"
                            : "text-terrain-300"
                        }`}
                      />
                    ))}
                  </div>
                  {hire.reviewText && (
                    <p className="text-sm text-terrain-600">
                      “{hire.reviewText}”
                    </p>
                  )}
                </div>
              ) : amIHirer ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setRatingDraft(n)}
                        aria-label={`${n} ${isNepali ? "तारा" : "star"}`}
                        className="p-0.5"
                      >
                        <Star
                          className={`h-7 w-7 transition-colors ${
                            n <= ratingDraft
                              ? "text-gold-500 fill-current"
                              : "text-terrain-300 hover:text-gold-400"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewDraft}
                    onChange={(e) => setReviewDraft(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder={
                      isNepali
                        ? "यो कामदारको कामबारे लेख्नुहोस् (वैकल्पिक)"
                        : "Write about this worker's work (optional)"
                    }
                    className="w-full rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  />
                  <Button
                    onClick={() => void handleSubmitReview()}
                    disabled={ratingDraft < 1 || submitReview.isPending}
                  >
                    {submitReview.isPending
                      ? isNepali
                        ? "पेश हुँदै..."
                        : "Submitting..."
                      : isNepali
                        ? "समीक्षा पेश गर्नुहोस्"
                        : "Submit review"}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-terrain-500">
                  {isNepali ? "अहिलेसम्म कुनै समीक्षा छैन।" : "No review yet."}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
