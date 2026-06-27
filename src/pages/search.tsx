import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useUIStore, useFilterStore } from "../store";
import {
  provinces,
  getDistrictsByProvince,
  jobCategories,
} from "@shram-sewa/shared/constants";
import { Button, Card, CardContent, Badge, Input } from "../components/ui";
import { WorkerCard } from "../components/WorkerCard";
import { HireModal } from "../components/HireModal";
import { WorkerCardSkeleton } from "../components/LoadingSkeleton";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../components/ui";
import { useToast } from "../components/ToastContainer";
import { Search, Filter, X, Database, AlertTriangle } from "lucide-react";
import type { WorkerDisplay } from "@shram-sewa/shared";
import {
  useWorkers,
  useDebouncedValue,
  useJobCategories,
  useLocalUnits,
  useMyWorkerProfile,
} from "../hooks";
import { isSupabaseConfigured } from "../lib";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type JobCategoryOption = {
  id: number;
  slug: string;
  nameEn: string;
  nameNp: string;
  icon?: string;
};

const staticJobCategoryOptions: JobCategoryOption[] = jobCategories.map(
  (category, index) => ({
    ...category,
    id: index + 1,
  }),
);

const PAGE_COLUMNS = 3;
const PAGE_ROWS = 3;
const PAGE_SIZE = PAGE_COLUMNS * PAGE_ROWS;

function parsePageParam(value: string | null): number {
  if (!value) {
    return 1;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function parseNumberParam(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return parsed;
}

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages: Array<number | "ellipsis-left" | "ellipsis-right"> = [];

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  pages.push(1);

  if (currentPage > 3) {
    pages.push("ellipsis-left");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }

  if (currentPage < totalPages - 2) {
    pages.push("ellipsis-right");
  }

  pages.push(totalPages);
  return pages;
}

export default function SearchPage() {
  const { locale } = useUIStore();
  const {
    filters,
    searchQuery,
    setSearchQuery,
    setSearchQueryFromUrl,
    setFiltersFromUrl,
    restoreLastUsed,
    setProvinceId,
    setDistrictId,
    setJobCategory,
    setFilters,
    clearFilters,
  } = useFilterStore();

  const provinceId = filters.provinceId;
  const districtId = filters.districtId;
  const localUnitId = filters.localUnitId;
  const wardNo = filters.wardNo;
  const jobCategory = filters.jobCategoryId;

  const [currentPage, setCurrentPage] = useState(() =>
    parsePageParam(new URLSearchParams(window.location.search).get("page")),
  );
  const [showFilters, setShowFilters] = useState(false);
  // Refs for click-outside dismissal of the filter panel (mobile UX: tapping
  // anywhere outside the panel or its toggle button collapses it).
  const filterPanelRef = useRef<HTMLDivElement>(null);
  const filterToggleRef = useRef<HTMLButtonElement>(null);
  const [selectedWorker, setSelectedWorker] = useState<WorkerDisplay | null>(
    null,
  );
  const [pendingCategorySlug, setPendingCategorySlug] = useState<
    string | undefined
  >(undefined);
  const [isHireModalOpen, setIsHireModalOpen] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();

  const toast = useToast();

  // Close the filter panel when tapping/clicking outside it (and outside the
  // toggle, so the toggle still works as a toggle). Only active while open.
  useEffect(() => {
    if (!showFilters) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        filterPanelRef.current?.contains(target) ||
        filterToggleRef.current?.contains(target)
      ) {
        return;
      }
      setShowFilters(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [showFilters]);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 160);
  const deferredSearchQuery = useDeferredValue(debouncedSearchQuery);
  const isSearching = debouncedSearchQuery.trim().length > 0;
  const isSearchDeferred = deferredSearchQuery !== debouncedSearchQuery;
  const isNepali = locale === "ne";
  const reduceMotion = useReducedMotion();
  const backendConfigured = isSupabaseConfigured();
  const jobCategoriesQuery = useJobCategories(backendConfigured);
  const backendJobCategoryOptions = useMemo<JobCategoryOption[]>(() => {
    if (!backendConfigured || !(jobCategoriesQuery.data ?? []).length) {
      return [];
    }

    return (jobCategoriesQuery.data ?? []).map((category: any) => ({
      id: Number(category.id),
      slug: String(category.slug),
      nameEn:
        typeof category.name_en === "string"
          ? category.name_en
          : (category.nameEn ?? ""),
      nameNp:
        typeof category.name_np === "string"
          ? category.name_np
          : (category.nameNp ?? ""),
      icon: category.icon ?? undefined,
    }));
  }, [backendConfigured, jobCategoriesQuery.data]);
  const jobCategoryOptions =
    backendJobCategoryOptions.length > 0
      ? backendJobCategoryOptions
      : staticJobCategoryOptions;
  const districts = provinceId ? getDistrictsByProvince(provinceId) : [];
  // Municipalities (local units) for the chosen district, + ward options for
  // the chosen municipality (1 … its ward_count).
  const localUnitsQuery = useLocalUnits(districtId);
  const localUnits = (localUnitsQuery.data ?? []) as Array<{
    id: number;
    name_en: string;
    name_np?: string | null;
    ward_count?: number | null;
  }>;
  const wardCount =
    localUnits.find((u) => u.id === localUnitId)?.ward_count ?? 0;
  const wardOptions = Array.from({ length: wardCount }, (_, i) => i + 1);
  const hasActiveFilters = Boolean(
    provinceId ||
      districtId ||
      localUnitId ||
      wardNo ||
      jobCategory ||
      searchQuery.trim(),
  );
  const queryPage = isSearching ? 1 : currentPage;
  const queryPageSize = isSearching ? 300 : PAGE_SIZE;

  // The searcher's own location anchors proximity ranking (nearest workers
  // first). Available when the user has a worker profile; harmless otherwise.
  const myProfile = useMyWorkerProfile(backendConfigured).data;

  const workersQuery = useWorkers(
    {
      provinceId,
      districtId,
      localUnitId,
      wardNo,
      jobCategoryId: jobCategory,
      isAvailable: true,
      search: debouncedSearchQuery,
      anchorProvinceId: myProfile?.provinceId,
      anchorDistrictId: myProfile?.districtId,
      anchorLocalUnitId: myProfile?.localUnitId,
      anchorWardNo: myProfile?.wardNo,
    } as any,
    queryPage,
    queryPageSize,
    backendConfigured,
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const provinceFromUrl = parseNumberParam(params.get("provinceId"));
    const districtFromUrl = parseNumberParam(params.get("districtId"));
    const jobCategoryIdFromUrl = parseNumberParam(params.get("jobCategoryId"));
    const jobCategorySlugFromUrl = params.get("jobCategory");

    const hasUrlFilters =
      provinceFromUrl !== undefined ||
      districtFromUrl !== undefined ||
      jobCategoryIdFromUrl !== undefined ||
      !!jobCategorySlugFromUrl;

    if (!hasUrlFilters) {
      restoreLastUsed();
      return;
    }

    const urlFilters: Record<string, number> = {};
    if (provinceFromUrl !== undefined) {
      urlFilters.provinceId = provinceFromUrl;
    }
    if (districtFromUrl !== undefined) {
      urlFilters.districtId = districtFromUrl;
    }
    if (jobCategoryIdFromUrl !== undefined) {
      urlFilters.jobCategoryId = jobCategoryIdFromUrl;
    }

    setFiltersFromUrl(urlFilters, { replace: true });
    setSearchQueryFromUrl("");
    setPendingCategorySlug(
      jobCategoryIdFromUrl ? undefined : (jobCategorySlugFromUrl ?? undefined),
    );
  }, [restoreLastUsed, setFiltersFromUrl, setSearchQueryFromUrl]);

  useEffect(() => {
    if (!pendingCategorySlug) {
      return;
    }

    const staticCategory = staticJobCategoryOptions.find(
      (category) => category.slug === pendingCategorySlug,
    );

    // Ensure slug links still narrow results even if category ids differ by environment.
    if (staticCategory) {
      if (!searchQuery.trim()) {
        setSearchQueryFromUrl(staticCategory.nameEn);
      }
      if (!jobCategory) {
        setFiltersFromUrl({ jobCategoryId: staticCategory.id });
      }
    }

    if (!backendConfigured || backendJobCategoryOptions.length === 0) {
      return;
    }

    const backendCategory = backendJobCategoryOptions.find(
      (category) => category.slug === pendingCategorySlug,
    );
    if (backendCategory && backendCategory.id !== jobCategory) {
      setFiltersFromUrl({ jobCategoryId: backendCategory.id });
    }
  }, [
    backendConfigured,
    backendJobCategoryOptions,
    jobCategory,
    pendingCategorySlug,
    searchQuery,
    setFiltersFromUrl,
    setSearchQueryFromUrl,
  ]);

  useEffect(() => {
    if (!backendConfigured || backendJobCategoryOptions.length === 0) {
      return;
    }

    if (!jobCategory) {
      return;
    }

    const backendMatch = backendJobCategoryOptions.find(
      (category) => category.id === jobCategory,
    );
    if (backendMatch) {
      return;
    }

    const staticMatch = staticJobCategoryOptions.find(
      (category) => category.id === jobCategory,
    );
    if (!staticMatch) {
      return;
    }

    const mapped = backendJobCategoryOptions.find(
      (category) => category.slug === staticMatch.slug,
    );
    if (mapped) {
      setJobCategory(mapped.id);
    }
  }, [
    backendConfigured,
    backendJobCategoryOptions,
    jobCategory,
    setJobCategory,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(currentPage));
    }

    const search = params.toString();
    const nextUrl = search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname;

    if (window.location.href !== `${window.location.origin}${nextUrl}`) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [currentPage]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(
        parsePageParam(new URLSearchParams(window.location.search).get("page")),
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const totalWorkers = workersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalWorkers / PAGE_SIZE));
  const visiblePage = Math.min(currentPage, totalPages);

  const workers = useMemo(
    () => (workersQuery.data?.data ?? []) as WorkerDisplay[],
    [workersQuery.data],
  );

  const filteredWorkers = workers;

  const isLoading =
    backendConfigured && (workersQuery.isLoading || workersQuery.isFetching);
  const resultCount = isSearching ? filteredWorkers.length : totalWorkers;
  const paginationItems = useMemo(
    () => getPaginationItems(visiblePage, totalPages),
    [visiblePage, totalPages],
  );
  const queryError = workersQuery.error;
  const queryErrorMessage =
    queryError instanceof Error
      ? queryError.message
      : isNepali
        ? "कामदार सूची लोड गर्न असफल भयो"
        : "Failed to load workers";

  const handleClearFilters = () => {
    startTransition(() => {
      clearFilters();
      setPendingCategorySlug(undefined);
      setCurrentPage(1);
    });
  };

  const handlePageChange = (nextPage: number) => {
    startTransition(() => {
      setCurrentPage(Math.max(1, nextPage));
    });
  };

  const handleHireClick = (workerId: string) => {
    if (!backendConfigured) {
      toast.warning(
        isNepali ? "सेवा उपलब्ध छैन" : "Service unavailable",
        isNepali
          ? "कामदार भाडा सेवा अहिले अस्थायी रूपमा बन्द छ।"
          : "Hiring is temporarily unavailable right now.",
      );
      return;
    }

    const worker = filteredWorkers.find((item) => item.id === workerId);
    if (!worker) {
      toast.error("Error", "Worker not found");
      return;
    }

    if (!worker.isAvailable) {
      toast.warning("Unavailable", "This worker is currently unavailable");
      return;
    }

    setSelectedWorker(worker);
    setIsHireModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-terrain-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isNepali ? "कामदार खोज्नुहोस्..." : "Search workers..."
            }
            className="pl-10"
          />
        </div>
        <Button
          ref={filterToggleRef}
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          {isNepali ? "फिल्टर" : "Filters"}
          {hasActiveFilters && (
            <Badge variant="gold" className="ml-1">
              {
                [provinceId, districtId, localUnitId, wardNo, jobCategory].filter(
                  Boolean,
                ).length
              }
            </Badge>
          )}
        </Button>
      </div>

      {/* Filters Panel */}
      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div
            ref={filterPanelRef}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-mountain-900">
                    {isNepali ? "फिल्टरहरू" : "Filters"}
                  </h3>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="gap-1 text-terrain-500"
                    >
                      <X className="w-4 h-4" />
                      {isNepali ? "सबै हटाउनुहोस्" : "Clear all"}
                    </Button>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {/* Province */}
                  <div>
                    <label className="text-sm font-medium text-mountain-700 mb-1.5 block">
                      {isNepali ? "प्रदेश" : "Province"}
                    </label>
                    <select
                      value={provinceId || ""}
                      onChange={(e) => {
                        startTransition(() => {
                          setProvinceId(
                            e.target.value ? Number(e.target.value) : undefined,
                          );
                          setDistrictId(undefined);
                          setFilters({
                            localUnitId: undefined,
                            wardNo: undefined,
                          });
                          setCurrentPage(1);
                        });
                      }}
                      className="w-full h-10 rounded-md border border-terrain-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500"
                    >
                      <option value="">
                        {isNepali ? "सबै प्रदेश" : "All provinces"}
                      </option>
                      {provinces.map((province) => (
                        <option key={province.id} value={province.id}>
                          {isNepali ? province.nameNp : province.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District */}
                  <div>
                    <label className="text-sm font-medium text-mountain-700 mb-1.5 block">
                      {isNepali ? "जिल्ला" : "District"}
                    </label>
                    <select
                      value={districtId || ""}
                      onChange={(e) => {
                        startTransition(() => {
                          setDistrictId(
                            e.target.value ? Number(e.target.value) : undefined,
                          );
                          setFilters({
                            localUnitId: undefined,
                            wardNo: undefined,
                          });
                          setCurrentPage(1);
                        });
                      }}
                      disabled={!provinceId}
                      className="w-full h-10 rounded-md border border-terrain-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isNepali ? "सबै जिल्ला" : "All districts"}
                      </option>
                      {districts.map((district) => (
                        <option key={district.id} value={district.id}>
                          {isNepali ? district.nameNp : district.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Municipality (local unit) */}
                  <div>
                    <label className="text-sm font-medium text-mountain-700 mb-1.5 block">
                      {isNepali ? "नगरपालिका" : "Municipality"}
                    </label>
                    <select
                      value={localUnitId || ""}
                      onChange={(e) => {
                        startTransition(() => {
                          setFilters({
                            localUnitId: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                            wardNo: undefined,
                          });
                          setCurrentPage(1);
                        });
                      }}
                      disabled={!districtId}
                      className="w-full h-10 rounded-md border border-terrain-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isNepali ? "सबै नगरपालिका" : "All municipalities"}
                      </option>
                      {localUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {isNepali ? u.name_np ?? u.name_en : u.name_en}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ward number */}
                  <div>
                    <label className="text-sm font-medium text-mountain-700 mb-1.5 block">
                      {isNepali ? "वडा नं." : "Ward No."}
                    </label>
                    <select
                      value={wardNo || ""}
                      onChange={(e) => {
                        startTransition(() => {
                          setFilters({
                            wardNo: e.target.value
                              ? Number(e.target.value)
                              : undefined,
                          });
                          setCurrentPage(1);
                        });
                      }}
                      disabled={!localUnitId}
                      className="w-full h-10 rounded-md border border-terrain-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {isNepali ? "सबै वडा" : "All wards"}
                      </option>
                      {wardOptions.map((w) => (
                        <option key={w} value={w}>
                          {isNepali ? `वडा ${w}` : `Ward ${w}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Job Category */}
                  <div>
                    <label className="text-sm font-medium text-mountain-700 mb-1.5 block">
                      {isNepali ? "कार्य वर्ग" : "Job Category"}
                    </label>
                    <select
                      value={jobCategory || ""}
                      onChange={(e) => {
                        startTransition(() => {
                          setJobCategory(
                            e.target.value ? Number(e.target.value) : undefined,
                          );
                          setCurrentPage(1);
                        });
                      }}
                      className="w-full h-10 rounded-md border border-terrain-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-crimson-500"
                    >
                      <option value="">
                        {isNepali ? "सबै वर्ग" : "All categories"}
                      </option>
                      {jobCategoryOptions.map((category) => (
                        <option key={category.slug} value={category.id}>
                          {category.icon}{" "}
                          {isNepali ? category.nameNp : category.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-mountain-900">
          {backendConfigured
            ? `${resultCount} ${isNepali ? "कामदार भेटियो" : "workers found"}`
            : isNepali
              ? "फिल्टर प्रयोग गरेर कार्य वर्ग हेर्नुहोस्"
              : "Browse by filters and job categories"}
        </h2>
        {backendConfigured && (isSearchDeferred || isPendingTransition) && (
          <span className="text-xs text-terrain-500 animate-pulse">
            {isNepali ? "अपडेट हुँदैछ..." : "Updating..."}
          </span>
        )}
      </div>

      {!backendConfigured && (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-10 h-10 mx-auto mb-3 text-terrain-500" />
            <h3 className="text-lg font-semibold text-mountain-900 mb-2">
              {isNepali
                ? "अहिलेलाई कामदार प्रोफाइल उपलब्ध छैन"
                : "Worker profiles are temporarily unavailable"}
            </h3>
            <p className="text-terrain-500">
              {isNepali
                ? "प्रदेश, जिल्ला र कार्य वर्ग चयन गरेर खोज फिल्टर तयार राख्न सक्नुहुन्छ।"
                : "You can still explore provinces, districts, and job categories using filters."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Worker Cards */}
      {backendConfigured && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <WorkerCardSkeleton key={index} />
              ))
            : filteredWorkers.map((worker) => (
                <WorkerCard
                  key={worker.id}
                  worker={worker}
                  onHire={handleHireClick}
                />
              ))}
        </div>
      )}

      {backendConfigured &&
        !isLoading &&
        !isSearching &&
        totalPages > 1 &&
        filteredWorkers.length > 0 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={visiblePage > 1 ? `?page=${visiblePage - 1}` : "#"}
                  onClick={(event) => {
                    event.preventDefault();
                    if (visiblePage > 1) {
                      handlePageChange(visiblePage - 1);
                    }
                  }}
                  className={
                    visiblePage <= 1 ? "pointer-events-none opacity-50" : ""
                  }
                />
              </PaginationItem>

              {paginationItems.map((item, index) => {
                if (item === "ellipsis-left" || item === "ellipsis-right") {
                  return (
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }

                return (
                  <PaginationItem key={`page-${item}`}>
                    <PaginationLink
                      href={item === 1 ? "/search" : `?page=${item}`}
                      isActive={visiblePage === item}
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              <PaginationItem>
                <PaginationNext
                  href={
                    visiblePage < totalPages ? `?page=${visiblePage + 1}` : "#"
                  }
                  onClick={(event) => {
                    event.preventDefault();
                    if (visiblePage < totalPages) {
                      handlePageChange(visiblePage + 1);
                    }
                  }}
                  className={
                    visiblePage >= totalPages
                      ? "pointer-events-none opacity-50"
                      : ""
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

      {/* Hire Modal */}
      {selectedWorker && (
        <HireModal
          isOpen={isHireModalOpen}
          onClose={() => {
            setIsHireModalOpen(false);
            setSelectedWorker(null);
          }}
          worker={{
            id: selectedWorker.id,
            name: isNepali
              ? (selectedWorker.user.fullNameNp ??
                selectedWorker.user.fullName ??
                "कामदार")
              : (selectedWorker.user.fullName ?? "Worker"),
            jobCategory: isNepali
              ? (selectedWorker.jobCategory.nameNp ??
                selectedWorker.jobCategory.nameEn)
              : selectedWorker.jobCategory.nameEn,
            dailyRate: selectedWorker.dailyRateNpr ?? 0,
            avatar: selectedWorker.user.avatarUrl,
          }}
        />
      )}

      {backendConfigured && !isLoading && filteredWorkers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">
              {queryError ? (
                <AlertTriangle className="w-10 h-10 mx-auto text-amber-600" />
              ) : (
                "🔍"
              )}
            </div>
            <h3 className="text-lg font-semibold text-mountain-900 mb-2">
              {queryError
                ? isNepali
                  ? "कामदार सूची लोड गर्न समस्या"
                  : "Unable to load workers"
                : isNepali
                  ? "कुनै कामदार भेटिएन"
                  : "No workers found"}
            </h3>
            <p className="text-terrain-500 mb-4">
              {queryError
                ? queryErrorMessage
                : isNepali
                  ? "फिल्टर परिवर्तन गरेर पुनः खोज्नुहोस्"
                  : "Try adjusting your filters"}
            </p>
            <Button variant="outline" onClick={handleClearFilters}>
              {isNepali ? "फिल्टर हटाउनुहोस्" : "Clear filters"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
