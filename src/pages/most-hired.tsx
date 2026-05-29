import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Trophy, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import type { WorkerDisplay } from "@shram-sewa/shared";
import { useMostHiredWorkers } from "../hooks";
import { isSupabaseConfigured } from "../lib";
import { useUIStore } from "../store";
import { WorkerCard } from "../components/WorkerCard";
import { WorkerCardSkeleton } from "../components/LoadingSkeleton";
import { Badge, Button, Card, CardContent } from "../components/ui";

function RankedWorkerCard({
  worker,
  rank,
  isNepali,
}: {
  worker: WorkerDisplay;
  rank: number;
  isNepali: boolean;
}) {
  return (
    <div className="relative">
      <span className="absolute -top-2 -left-2 z-10 rounded-full bg-crimson-700 text-white text-xs font-semibold px-2.5 py-1 shadow-sm">
        #{rank}
      </span>
      <span className="absolute top-3 right-3 z-10 rounded-full bg-white/90 text-mountain-900 text-xs font-semibold px-2.5 py-1 shadow-sm border border-terrain-200">
        {worker.totalHires} {isNepali ? "भाडा" : "hires"}
      </span>
      <WorkerCard worker={worker} />
    </div>
  );
}

export default function MostHiredPage() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();
  const [availableOnly, setAvailableOnly] = useState(false);

  const topWorkersQuery = useMostHiredWorkers(
    12,
    backendConfigured,
    availableOnly ? true : undefined,
  );

  const workers = useMemo(
    () => (topWorkersQuery.data?.data ?? []) as WorkerDisplay[],
    [topWorkersQuery.data],
  );

  const rankedWorkers = useMemo(() => {
    const withHires = workers.filter((worker) => worker.totalHires > 0);
    return withHires.length > 0 ? withHires : workers;
  }, [workers]);

  const totalHires = useMemo(
    () => rankedWorkers.reduce((sum, worker) => sum + worker.totalHires, 0),
    [rankedWorkers],
  );

  const isLoading =
    backendConfigured &&
    (topWorkersQuery.isLoading || topWorkersQuery.isFetching);
  const queryError = topWorkersQuery.error;
  const queryErrorMessage =
    queryError instanceof Error
      ? queryError.message
      : isNepali
        ? "सूची लोड गर्न समस्या भयो"
        : "Unable to load top workers";

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-terrain-200 bg-gradient-to-br from-terrain-50 via-white to-crimson-50/40 p-6 md:p-10">
        <Badge variant="gold" className="mb-4">
          {isNepali ? "सबैभन्दा बढी भाडा" : "Most Hired"}
        </Badge>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-mountain-900">
              {isNepali
                ? "सबैभन्दा धेरै भाडामा लिइएका कामदार"
                : "Most Hired Workers"}
            </h1>
            <p className="text-terrain-600 max-w-2xl">
              {isNepali
                ? "कुल भाडा र सेवा इतिहासका आधारमा श्रम सेवा प्लेटफर्ममा सबैभन्दा धेरै भाडामा लिइएका कामदारहरूको सूची।"
                : "Ranked by total completed hires and service history across the Shram Sewa platform."}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-terrain-500">
              <span className="inline-flex items-center gap-1">
                <Trophy className="w-4 h-4 text-gold-500" />
                {isNepali ? "सम्पूर्ण समयको डाटा" : "All-time data"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-4 h-4 text-crimson-700" />
                {rankedWorkers.length} {isNepali ? "कामदार" : "workers"}
              </span>
              {totalHires > 0 && (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {totalHires.toLocaleString("en-IN")} {isNepali ? "कुल भाडा" : "total hires"}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="rounded-full"
              onClick={() => setAvailableOnly((prev) => !prev)}
            >
              {availableOnly
                ? isNepali
                  ? "सबै देखाउनुहोस्"
                  : "Show all"
                : isNepali
                  ? "उपलब्ध मात्र"
                  : "Available only"}
            </Button>
            <Link to="/search" preload="intent">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full w-full"
              >
                {isNepali ? "कामदार खोज्नुहोस्" : "Find workers"}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {!backendConfigured && (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="w-10 h-10 mx-auto mb-3 text-terrain-500" />
            <h2 className="text-lg font-semibold text-mountain-900 mb-2">
              {isNepali
                ? "कामदार सूची अस्थायी रूपमा उपलब्ध छैन"
                : "Top workers are temporarily unavailable"}
            </h2>
            <p className="text-terrain-500">
              {isNepali
                ? "सेवा पुनः सुरु भएपछि सबैभन्दा धेरै भाडामा लिइएका कामदारहरूको सूची यहाँ देखिनेछ।"
                : "When the service is back online, the most hired workers will appear here."}
            </p>
          </CardContent>
        </Card>
      )}

      {backendConfigured && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-mountain-900">
              {isNepali ? "शीर्ष कामदारहरू" : "Top workers"}
            </h2>
            {availableOnly && (
              <Badge variant="success">
                {isNepali ? "उपलब्ध मात्र" : "Available only"}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <WorkerCardSkeleton key={`top-worker-${index}`} />
              ))}
            </div>
          ) : rankedWorkers.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rankedWorkers.map((worker, index) => (
                <RankedWorkerCard
                  key={worker.id}
                  worker={worker}
                  rank={index + 1}
                  isNepali={isNepali}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-10 text-center">
                <div className="text-3xl mb-3">🏅</div>
                <h3 className="text-lg font-semibold text-mountain-900 mb-2">
                  {queryError
                    ? isNepali
                      ? "सूची लोड गर्न समस्या"
                      : "Unable to load top workers"
                    : isNepali
                      ? "अहिलेसम्म कुनै भाडा रेकर्ड छैन"
                      : "No hire records yet"}
                </h3>
                <p className="text-terrain-500 mb-4">
                  {queryError
                    ? queryErrorMessage
                    : isNepali
                      ? "कामदारहरू भाडामा लिइएपछि यहाँ सूची अपडेट हुन्छ।"
                      : "This list updates once workers start getting hired."}
                </p>
                <Link to="/search" preload="intent">
                  <Button variant="outline">
                    {isNepali ? "कामदार खोज्नुहोस्" : "Find workers"}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {backendConfigured && queryError && rankedWorkers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700">
              <AlertTriangle className="w-4 h-4" />
              {queryErrorMessage}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
