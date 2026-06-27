import { useState, useEffect } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUIStore } from "../store";
import { useAuthStore } from "../store/auth-store";
import { Button, Card, CardContent, Input } from "../components/ui";
import { ArrowLeft, Calendar, Database, Briefcase, MapPin } from "lucide-react";
import {
  createIpFingerprint,
  hasHireIpLock,
  isSupabaseConfigured,
  resolveClientIpAddress,
  setHireIpLock,
  translateError,
  getSupabaseClient,
} from "../lib";
import { useCreateHireMutation, useLocalUnits } from "../hooks";
import { provinces, getDistrictsByProvince } from "@shram-sewa/shared";
import NepaliDate from "nepali-date";

// UI-shape schema for the hire form. Distinct from the API schema
// (createHireRequestSchema in shared/validation): the form deals with
// HTML input strings ("" empty, date string, optional rate-as-string),
// then maps to the API's typed payload at submit time.
const DURATION_OPTIONS = [1, 2, 3, 5, 7] as const;

const hireFormSchema = z.object({
  workDate: z
    .string()
    .min(1, "Work date is required")
    .refine(
      (value) => {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return parsed >= today;
      },
      { message: "Work date cannot be in the past" },
    ),
  workDurationDays: z.coerce
    .number()
    .int()
    .refine(
      (value) => DURATION_OPTIONS.includes(value as (typeof DURATION_OPTIONS)[number]),
      { message: "Select a valid duration" },
    ),
  description: z
    .string()
    .min(10, "Please describe the work in at least 10 characters")
    .max(500, "Description must be 500 characters or fewer"),
  // Rate is optional — UI labels it Optional, schema forwards undefined when blank.
  agreedRateNpr: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .int()
        .min(500, "Daily rate must be at least NPR 500")
        .max(10000, "Daily rate must not exceed NPR 10,000"),
    ])
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value)),
});

type HireFormValues = z.input<typeof hireFormSchema>;
type ParsedHireFormValues = z.output<typeof hireFormSchema>;

export default function HirePage() {
  const { workerId } = useParams({ from: "/hire/$workerId" });
  const { locale } = useUIStore();
  const { user, isAuthenticated } = useAuthStore();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();
  const isWorkerRole = isAuthenticated && user?.role === "worker";
  const createHireMutation = useCreateHireMutation();
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  // Work location (where the hirer wants the job done). Optional but lets the
  // worker see where the work is. Cascading province → district → local unit.
  const [provinceId, setProvinceId] = useState<number | undefined>(undefined);
  const [districtId, setDistrictId] = useState<number | undefined>(undefined);
  const [localUnitId, setLocalUnitId] = useState<number | undefined>(undefined);
  const provinceDistricts = provinceId
    ? getDistrictsByProvince(provinceId)
    : [];
  const localUnitsQuery = useLocalUnits(districtId);
  // Fast apply: remember the hirer's location for next time and pre-fill it.
  const [rememberLocation, setRememberLocation] = useState(true);
  const [prefilledFromSaved, setPrefilledFromSaved] = useState(false);

  // Auto-fill the location selects from the hirer's saved home location.
  useEffect(() => {
    if (!isAuthenticated || !user?.id || isWorkerRole || !backendConfigured) {
      return;
    }
    let active = true;
    void (async () => {
      try {
        const { data } = await (getSupabaseClient() as any)
          .from("users")
          .select("home_province_id, home_district_id, home_local_unit_id")
          .eq("id", user.id)
          .single();
        if (!active || !data) return;
        if (data.home_province_id) setProvinceId(data.home_province_id);
        if (data.home_district_id) setDistrictId(data.home_district_id);
        if (data.home_local_unit_id) setLocalUnitId(data.home_local_unit_id);
        if (data.home_province_id) setPrefilledFromSaved(true);
      } catch {
        // No saved location yet — leave the selects blank.
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, isWorkerRole, backendConfigured]);

  const form = useForm<HireFormValues>({
    resolver: zodResolver(hireFormSchema),
    mode: "onTouched",
    defaultValues: {
      workDate: "",
      workDurationDays: 1,
      description: "",
      agreedRateNpr: "",
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = form;

  const watchedDate = watch("workDate");

  const onSubmit = async (raw: HireFormValues) => {
    setSubmitError("");

    // Re-parse so we get the transformed (output) shape with normalized types.
    const parsed = hireFormSchema.parse(raw) as ParsedHireFormValues;

    if (!backendConfigured) {
      setSubmitError(
        isNepali
          ? "भाडा अनुरोध सेवा अहिले उपलब्ध छैन।"
          : "Hire request service is currently unavailable.",
      );
      return;
    }

    const hirerIp = await resolveClientIpAddress();

    if (hirerIp && hasHireIpLock(workerId, hirerIp)) {
      setSubmitError(
        isNepali
          ? "यस कामदारलाई यो IP बाट पहिले नै अनुरोध पठाइएको छ।"
          : "This worker has already been requested from this IP.",
      );
      return;
    }

    try {
      const ipFingerprint = createIpFingerprint();

      await createHireMutation.mutateAsync({
        workerId,
        hirerIp: hirerIp ?? undefined,
        ipFingerprint,
        workDescription: parsed.description,
        agreedRateNpr: parsed.agreedRateNpr,
        workDate: new Date(parsed.workDate),
        workDurationDays: parsed.workDurationDays,
        hireProvinceId: provinceId,
        hireDistrictId: districtId,
        hireLocalUnitId: localUnitId,
      });

      // Save the chosen location to the hirer's profile for fast apply later.
      if (rememberLocation && provinceId && user?.id) {
        try {
          await (getSupabaseClient() as any)
            .from("users")
            .update({
              home_province_id: provinceId,
              home_district_id: districtId ?? null,
              home_local_unit_id: localUnitId ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", user.id);
        } catch {
          // Non-fatal: the hire still succeeded.
        }
      }

      if (hirerIp) {
        setHireIpLock(workerId, hirerIp, ipFingerprint);
      }
      setIsSuccess(true);
    } catch (error) {
      // context: "hire" → a duplicate (same IP already requested this
      // worker) becomes "You have already sent a hire request…" instead
      // of a raw 409 / 23505.
      setSubmitError(translateError(error, { isNepali, context: "hire" }));
    }
  };

  // Worker-mode accounts cannot hire. The DB + edge function already block it;
  // this is the friendly UI gate so they aren't shown a form that will fail.
  if (isWorkerRole) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Link
          to="/worker/$workerId"
          params={{ workerId }}
          className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
        >
          <ArrowLeft className="w-4 h-4" />
          {isNepali ? "फिर्ता" : "Back"}
        </Link>
        <Card>
          <CardContent className="p-8 text-center">
            <Briefcase className="w-10 h-10 mx-auto mb-3 text-crimson-700" />
            <h1 className="text-xl font-bold text-mountain-900 mb-2">
              {isNepali ? "कामदार मोडमा भाडामा लिन मिल्दैन" : "Hiring is disabled in worker mode"}
            </h1>
            <p className="text-terrain-500 mb-6">
              {isNepali
                ? "भाडामा लिन कृपया रोजगारदाता मोडमा बदल्नुहोस्।"
                : "To hire workers, switch your account to hirer mode."}
            </p>
            <Link to="/profile">
              <Button>
                {isNepali ? "प्रोफाइलमा जानुहोस्" : "Go to profile"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h1 className="text-2xl font-bold text-mountain-900 mb-2">
              {isNepali ? "अनुरोध सफलतापूर्वक पठाइयो" : "Request Sent"}
            </h1>
            <p className="text-terrain-500 mb-6">
              {isNepali
                ? "कामदारलाई तपाईंको अनुरोध पठाइएको छ।"
                : "Your hire request has been sent to the worker."}
            </p>
            <div className="flex gap-3 justify-center">
              <Link to="/profile">
                <Button>{isNepali ? "मेरो प्रोफाइल" : "My Profile"}</Button>
              </Link>
              <Link to="/search">
                <Button variant="outline">
                  {isNepali ? "फेरि खोज्नुहोस्" : "Search Again"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fieldErrorMessage = (key: keyof HireFormValues) => {
    const message = errors[key]?.message;
    return typeof message === "string" ? message : null;
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Link
        to="/worker/$workerId"
        params={{ workerId }}
        className="inline-flex items-center gap-2 text-sm text-terrain-500 hover:text-crimson-700"
      >
        <ArrowLeft className="w-4 h-4" />
        {isNepali ? "फिर्ता" : "Back"}
      </Link>

      <Card>
        <CardContent className="p-6">
          <h1 className="text-xl font-bold text-mountain-900 mb-6">
            {isNepali ? "भाडा अनुरोध" : "Hire Request"}
          </h1>

          {!backendConfigured && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <Database className="w-4 h-4 mt-0.5" />
                <span>
                  {isNepali
                    ? "अहिलेलाई भाडा अनुरोध सेवा अस्थायी रूपमा बन्द छ।"
                    : "Hire requests are temporarily unavailable right now."}
                </span>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-mountain-700 mb-1.5">
                <div className="flex items-center">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  {isNepali ? "काम मिति" : "Work Date"}
                </div>
                {watchedDate && (
                  <span className="text-xs text-terrain-500 font-normal ml-auto">
                    (वि.सं.{" "}
                    {(() => {
                      const parsed = new Date(watchedDate);
                      return Number.isNaN(parsed.getTime())
                        ? ""
                        : new NepaliDate(parsed).format("YYYY-MM-DD");
                    })()}
                    )
                  </span>
                )}
              </label>
              <Input type="date" {...register("workDate")} />
              {fieldErrorMessage("workDate") && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrorMessage("workDate")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-mountain-700 mb-1.5">
                {isNepali ? "अवधि (दिन)" : "Duration (days)"}
              </label>
              <select
                {...register("workDurationDays", { valueAsNumber: true })}
                className="w-full h-10 rounded-md border border-terrain-300 px-3"
              >
                {DURATION_OPTIONS.map((day) => (
                  <option key={day} value={day}>
                    {day} {isNepali ? "दिन" : "days"}
                  </option>
                ))}
              </select>
              {fieldErrorMessage("workDurationDays") && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrorMessage("workDurationDays")}
                </p>
              )}
            </div>

            {/* Work location (optional) — cascading province → district → ward */}
            <div className="space-y-3">
              <label className="flex items-center gap-1.5 text-sm font-medium text-mountain-700">
                <MapPin className="w-4 h-4" />
                {isNepali ? "काम गर्ने स्थान (वैकल्पिक)" : "Work location (optional)"}
              </label>
              {prefilledFromSaved && (
                <p className="text-xs text-emerald-700">
                  {isNepali
                    ? "तपाईंको सुरक्षित स्थानबाट स्वतः भरियो।"
                    : "Auto-filled from your saved location."}
                </p>
              )}
              <select
                value={provinceId ?? ""}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setProvinceId(v);
                  setDistrictId(undefined);
                  setLocalUnitId(undefined);
                }}
                className="w-full h-10 rounded-md border border-terrain-300 px-3"
              >
                <option value="">
                  {isNepali ? "प्रदेश छान्नुहोस्" : "Select province"}
                </option>
                {provinces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {isNepali ? p.nameNp : p.nameEn}
                  </option>
                ))}
              </select>
              <select
                value={districtId ?? ""}
                disabled={!provinceId}
                onChange={(e) => {
                  const v = e.target.value ? Number(e.target.value) : undefined;
                  setDistrictId(v);
                  setLocalUnitId(undefined);
                }}
                className="w-full h-10 rounded-md border border-terrain-300 px-3 disabled:bg-terrain-50 disabled:text-terrain-400"
              >
                <option value="">
                  {isNepali ? "जिल्ला छान्नुहोस्" : "Select district"}
                </option>
                {provinceDistricts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {isNepali ? d.nameNp : d.nameEn}
                  </option>
                ))}
              </select>
              <select
                value={localUnitId ?? ""}
                disabled={!districtId || localUnitsQuery.isLoading}
                onChange={(e) =>
                  setLocalUnitId(
                    e.target.value ? Number(e.target.value) : undefined,
                  )
                }
                className="w-full h-10 rounded-md border border-terrain-300 px-3 disabled:bg-terrain-50 disabled:text-terrain-400"
              >
                <option value="">
                  {isNepali ? "स्थानीय तह छान्नुहोस्" : "Select local unit"}
                </option>
                {(localUnitsQuery.data || []).map((u: { id: number; name_en: string; name_np?: string | null }) => (
                  <option key={u.id} value={u.id}>
                    {isNepali ? (u.name_np ?? u.name_en) : u.name_en}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-terrain-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberLocation}
                  onChange={(e) => setRememberLocation(e.target.checked)}
                  className="h-4 w-4 rounded border-terrain-300 accent-crimson-700"
                />
                {isNepali
                  ? "अर्को पटक छिटो भर्न यो स्थान सम्झनुहोस्"
                  : "Remember this location for faster hiring next time"}
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-mountain-700 mb-1.5">
                {isNepali ? "दैनिक दर (रु)" : "Daily Rate (NPR)"}
              </label>
              <Input
                type="number"
                min={500}
                placeholder={isNepali ? "वैकल्पिक" : "Optional"}
                {...register("agreedRateNpr")}
              />
              {fieldErrorMessage("agreedRateNpr") && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrorMessage("agreedRateNpr")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-mountain-700 mb-1.5">
                {isNepali ? "विवरण" : "Description"}
              </label>
              <textarea
                {...register("description")}
                rows={3}
                className="w-full rounded-md border border-terrain-300 px-3 py-2"
              />
              {fieldErrorMessage("description") && (
                <p className="mt-1 text-xs text-red-600">
                  {fieldErrorMessage("description")}
                </p>
              )}
            </div>

            <div className="bg-terrain-50 rounded-lg p-4">
              <div className="flex justify-between gap-2">
                <span>{isNepali ? "दर" : "Rate"}</span>
                <span className="font-medium text-terrain-700 text-right">
                  {(() => {
                    const v = watch("agreedRateNpr");
                    if (v === "" || v === undefined) {
                      return isNepali
                        ? "कामदारसँग छलफल गरी निश्चित गरिनेछ"
                        : "Will be agreed directly with the worker";
                    }
                    return `रु ${Number(v).toLocaleString("en-IN")}/day`;
                  })()}
                </span>
              </div>
            </div>

            {submitError && (
              <p className="text-sm text-red-600">{submitError}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={
                isSubmitting ||
                createHireMutation.isPending ||
                !backendConfigured
              }
            >
              {isSubmitting || createHireMutation.isPending
                ? isNepali
                  ? "पठाउँदै..."
                  : "Sending..."
                : isNepali
                  ? "पठाउनुहोस्"
                  : "Send Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
