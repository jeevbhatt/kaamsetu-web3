import { useParams, Link } from "@tanstack/react-router";
import { useUIStore } from "../store";
import { useAuthStore } from "../store/auth-store";
import { Button, Card, CardContent, Badge } from "../components/ui";
import {
  Star,
  MapPin,
  Calendar,
  ArrowLeft,
  CheckCircle,
  Database,
  AlertTriangle,
} from "lucide-react";
import { useWorker } from "../hooks";
import { isSupabaseConfigured, translateError } from "../lib";
import type { WorkerDisplay } from "@shram-sewa/shared";

export default function WorkerPage() {
  const { workerId } = useParams({ from: "/worker/$workerId" });
  const { locale } = useUIStore();
  const { user, isAuthenticated } = useAuthStore();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();
  // Worker-mode accounts cannot hire (mirrors the hire_records RLS block).
  const isWorkerRole = isAuthenticated && user?.role === "worker";

  const workerQuery = useWorker(workerId, backendConfigured);

  if (!backendConfigured) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          to="/search"
          className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNepali ? "खोजमा फर्कनुहोस्" : "Back to search"}
        </Link>

        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-10 h-10 mx-auto mb-3 text-terrain-500" />
            <h2 className="text-xl font-semibold text-mountain-900 mb-2">
              {isNepali
                ? "कामदार विवरण उपलब्ध छैन"
                : "Worker details are unavailable"}
            </h2>
            <p className="text-terrain-500">
              {isNepali
                ? "यो समयमा कामदार विवरण लोड गर्न सकिएन।"
                : "Unable to load worker profiles at the moment."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (workerQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-crimson-700" />
      </div>
    );
  }

  if (workerQuery.error || !workerQuery.data) {
    const errorMessage = workerQuery.error
      ? translateError(workerQuery.error, { isNepali, context: "generic" })
      : null;

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Link
          to="/search"
          className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNepali ? "खोजमा फर्कनुहोस्" : "Back to search"}
        </Link>

        <Card>
          <CardContent className="p-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h2 className="text-xl font-semibold text-mountain-900 mb-1">
                  {isNepali ? "कामदार भेटिएन" : "Worker not found"}
                </h2>
                <p className="text-terrain-500">
                  {errorMessage ??
                    (isNepali
                      ? "यो कामदार विवरण उपलब्ध छैन।"
                      : "This worker profile is unavailable.")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const worker = workerQuery.data as WorkerDisplay;

  const workerName = isNepali
    ? (worker.user.fullNameNp ??
      worker.user.fullName ??
      worker.fullNameNp ??
      worker.fullName)
    : (worker.user.fullName ?? worker.fullName);

  const jobName = isNepali
    ? (worker.jobCategory.nameNp ?? worker.jobCategory.nameEn)
    : worker.jobCategory.nameEn;

  const districtName = isNepali
    ? (worker.district.nameNp ?? worker.district.nameEn)
    : worker.district.nameEn;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/search"
        className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
      >
        <ArrowLeft className="w-4 h-4" />
        {isNepali ? "खोजमा फर्कनुहोस्" : "Back to search"}
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-terrain-200 flex items-center justify-center text-4xl overflow-hidden shadow-sm">
                {worker.user?.avatarUrl ? (
                  <img
                    src={worker.user.avatarUrl}
                    alt={workerName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className={worker.user?.avatarUrl ? "hidden" : ""}>
                  {worker.jobCategory.icon || "👤"}
                </span>
              </div>
              {worker.isAvailable && (
                <Badge variant="available" className="mt-2">
                  {isNepali ? "उपलब्ध" : "Available"}
                </Badge>
              )}
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-mountain-900">
                  {workerName}
                </h1>
                {worker.isApproved && (
                  <Badge
                    variant="success"
                    className="inline-flex items-center gap-1"
                    title={
                      isNepali
                        ? "श्रम सेवाद्वारा प्रमाणित"
                        : "Verified by Shram Sewa"
                    }
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {isNepali ? "प्रमाणित" : "Verified"}
                  </Badge>
                )}
              </div>

              <p className="text-lg text-terrain-500 mb-4">{jobName}</p>

              <div className="flex flex-wrap gap-4 mb-4">
                {worker.avgRating > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-5 h-5 text-gold-500 fill-current" />
                    <span className="font-semibold">
                      {worker.avgRating.toFixed(1)}
                    </span>
                    <span className="text-terrain-500">
                      ({worker.totalReviews})
                    </span>
                  </div>
                )}

                {worker.experienceYrs > 0 && (
                  <div className="flex items-center gap-1 text-terrain-500">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {worker.experienceYrs} {isNepali ? "वर्ष" : "years"}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-terrain-500">
                  <MapPin className="w-4 h-4" />
                  <span>{districtName}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-2xl font-bold text-crimson-700">
                    रु {(worker.dailyRateNpr ?? 0).toLocaleString()}
                  </span>
                  <span className="text-terrain-500">/day</span>
                </div>
                {isWorkerRole ? (
                  <div className="flex flex-col items-start gap-1">
                    <Button size="lg" disabled title={isNepali ? "कामदार मोडमा भाडामा लिन मिल्दैन" : "Hiring is disabled in worker mode"}>
                      {isNepali ? "भाडामा लिनुहोस्" : "Hire Now"}
                    </Button>
                    <Link
                      to="/profile"
                      className="text-xs text-crimson-700 hover:underline"
                    >
                      {isNepali
                        ? "भाडामा लिन रोजगारदाता मोडमा बदल्नुहोस्"
                        : "Switch to hirer mode to hire"}
                    </Link>
                  </div>
                ) : (
                  <Link to="/hire/$workerId" params={{ workerId: worker.id }}>
                    <Button size="lg" disabled={!worker.isAvailable}>
                      {isNepali ? "भाडामा लिनुहोस्" : "Hire Now"}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-mountain-900 mb-3">
            {isNepali ? "परिचय" : "About"}
          </h2>
          <p className="text-terrain-600">
            {worker.about ??
              (isNepali ? "विवरण उपलब्ध छैन" : "No description available")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-mountain-900 mb-4">
            {isNepali ? "तथ्याङ्क" : "Statistics"}
          </h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-crimson-700">
                {worker.totalHires}
              </div>
              <div className="text-sm text-terrain-500">
                {isNepali ? "भाडा" : "Hires"}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-gold-700">
                {worker.avgRating.toFixed(1)}
              </div>
              <div className="text-sm text-terrain-500">
                {isNepali ? "रेटिङ" : "Rating"}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">
                {worker.totalReviews}
              </div>
              <div className="text-sm text-terrain-500">
                {isNepali ? "समीक्षा" : "Reviews"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
