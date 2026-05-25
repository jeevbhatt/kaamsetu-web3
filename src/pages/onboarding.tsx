import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthStore, useUIStore } from "../store";
import {
  authApi,
  workerProfilesApi,
  provinces,
  getDistrictsByProvince,
} from "@shram-sewa/shared";
import { Card, CardContent, Button, Input, Progress } from "../components/ui";
import { User, Briefcase, MapPin, ChevronRight, Check } from "lucide-react";
import { useJobCategories, useLocalUnits } from "../hooks";
import { useState } from "react";

// ─── Onboarding form schema ────────────────────────────────────────────
//
// One unified Zod object covers all three steps so the final submit is
// a single `handleSubmit(onSubmit)`. We validate per-step using
// `trigger(["a","b"])` before advancing, so the user only sees errors
// for fields visible on the current step.
//
// Worker-only fields (jobCategoryId, dailyRateNpr) are required only when
// role === "worker"; superRefine enforces that conditionally so the
// hirer-only path doesn't fail validation on missing worker data.

const onboardingSchema = z
  .object({
    role: z.enum(["worker", "hirer"]),
    fullName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters"),
    provinceId: z.coerce
      .number()
      .int()
      .min(1, "Province is required")
      .max(7),
    districtId: z.coerce
      .number()
      .int()
      .min(1, "District is required")
      .max(77),
    localUnitId: z.coerce
      .number()
      .int()
      .positive("Local unit is required"),

    // Worker-only fields (validated conditionally below)
    jobCategoryId: z.coerce.number().int().positive().optional(),
    experienceYrs: z.coerce.number().int().min(0).max(50).optional(),
    dailyRateNpr: z.coerce
      .number()
      .int()
      .min(500, "Daily rate must be at least NPR 500")
      .max(10000, "Daily rate must not exceed NPR 10,000")
      .optional(),
    about: z.string().max(500, "Bio must not exceed 500 characters").optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "worker") {
      if (!data.jobCategoryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["jobCategoryId"],
          message: "Job category is required",
        });
      }
      if (data.dailyRateNpr === undefined || data.dailyRateNpr === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dailyRateNpr"],
          message: "Daily rate is required",
        });
      }
    }
  });

type OnboardingFormValues = z.input<typeof onboardingSchema>;

function localizeError(message: string | undefined, isNepali: boolean): string | null {
  if (!message) return null;
  if (!isNepali) return message;

  if (message.includes("Name must be at least 2 characters")) {
    return "नाम कम्तीमा २ अक्षरको हुनुपर्छ";
  }
  if (message.includes("Name must not exceed 100 characters")) {
    return "नाम १०० अक्षरभन्दा बढी हुनु हुँदैन";
  }
  if (message.includes("Province is required")) {
    return "प्रदेश आवश्यक छ";
  }
  if (message.includes("District is required")) {
    return "जिल्ला आवश्यक छ";
  }
  if (message.includes("Local unit is required")) {
    return "स्थानीय तह आवश्यक छ";
  }
  if (message.includes("Job category is required")) {
    return "कामको वर्ग आवश्यक छ";
  }
  if (message.includes("Daily rate is required")) {
    return "दैनिक ज्याला आवश्यक छ";
  }
  if (message.includes("Daily rate must be at least")) {
    return "दैनिक ज्याला कम्तीमा रु ५०० हुनुपर्छ";
  }
  if (message.includes("Daily rate must not exceed")) {
    return "दैनिक ज्याला रु १०,००० भन्दा बढी हुनु हुँदैन";
  }
  if (message.includes("Bio must not exceed 500 characters")) {
    return "बायो ५०० अक्षरभन्दा बढी हुनु हुँदैन";
  }
  return message;
}

export default function OnboardingPage() {
  const { user, isProfileComplete, initialize } = useAuthStore();
  const { locale } = useUIStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";

  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: "onTouched",
    defaultValues: {
      role: undefined,
      fullName: user?.fullName || "",
      provinceId: undefined,
      districtId: undefined,
      localUnitId: undefined,
      jobCategoryId: undefined,
      experienceYrs: 0,
      dailyRateNpr: undefined,
      about: "",
    },
  });

  const {
    register,
    setValue,
    watch,
    trigger,
    handleSubmit,
    formState: { errors },
  } = form;

  const role = watch("role");
  const provinceId = watch("provinceId");
  const districtId = watch("districtId");

  const jobCategoriesQuery = useJobCategories(true);
  const localUnitsQuery = useLocalUnits(districtId || undefined);
  const provinceDistricts = provinceId ? getDistrictsByProvince(provinceId) : [];

  const totalSteps = role === "worker" ? 3 : role === "hirer" ? 2 : 3;
  const progress = (step / totalSteps) * 100;

  useEffect(() => {
    if (isProfileComplete()) {
      navigate({ to: "/profile", replace: true });
    }
  }, [isProfileComplete, navigate]);

  // When province changes, the cascading selects below it must reset so a
  // stale district/local-unit doesn't quietly submit with the new province.
  useEffect(() => {
    setValue("districtId", undefined as unknown as number);
    setValue("localUnitId", undefined as unknown as number);
  }, [provinceId, setValue]);

  useEffect(() => {
    setValue("localUnitId", undefined as unknown as number);
  }, [districtId, setValue]);

  const advance = async () => {
    setSubmitError(null);

    if (step === 1) {
      const ok = await trigger(["role"]);
      if (!ok) return;
    } else if (step === 2) {
      const ok = await trigger([
        "fullName",
        "provinceId",
        "districtId",
        "localUnitId",
      ]);
      if (!ok) return;
    }

    setStep((s) => Math.min(s + 1, totalSteps));
  };

  const onSubmit = async (values: OnboardingFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      // 1. Update user metadata (name + role).
      await authApi.updateUser({
        data: {
          full_name: values.fullName,
          role: values.role,
        },
      });

      // 2. Worker-only: upsert worker_profiles row.
      if (values.role === "worker" && user?.id) {
        await workerProfilesApi.upsertByUserId(user.id, {
          jobCategoryId: Number(values.jobCategoryId),
          provinceId: Number(values.provinceId),
          districtId: Number(values.districtId),
          localUnitId: Number(values.localUnitId),
          // Default ward 1 — we'll prompt for ward in a later screen
          // (most rural municipalities have ≤9 wards; default keeps the
          // initial flow simple while still recording a valid value).
          wardNo: 1,
          experienceYrs: Number(values.experienceYrs ?? 0),
          dailyRateNpr: Number(values.dailyRateNpr),
          about: values.about?.trim() ?? "",
        });
      }

      await initialize();
      navigate({ to: "/profile", replace: true });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : isNepali
            ? "सेटअप गर्न समस्या भयो।"
            : "An error occurred during setup.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h2 className="text-2xl font-bold text-mountain-900 text-center">
              {isNepali ? "तपाईंको भूमिका के हो?" : "What is your role?"}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() =>
                  setValue("role", "worker", { shouldValidate: true })
                }
                className={`p-6 rounded-2xl border-2 text-center transition-all ${
                  role === "worker"
                    ? "border-crimson-700 bg-crimson-50"
                    : "border-terrain-200 hover:border-crimson-300"
                }`}
              >
                <Briefcase
                  className={`w-12 h-12 mx-auto mb-4 ${
                    role === "worker"
                      ? "text-crimson-700"
                      : "text-terrain-500"
                  }`}
                />
                <h3 className="font-bold text-lg mb-2">
                  {isNepali ? "कामदार" : "Worker"}
                </h3>
                <p className="text-sm text-terrain-600">
                  {isNepali ? "म काम खोज्दै छु" : "I am looking for work"}
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  setValue("role", "hirer", { shouldValidate: true })
                }
                className={`p-6 rounded-2xl border-2 text-center transition-all ${
                  role === "hirer"
                    ? "border-crimson-700 bg-crimson-50"
                    : "border-terrain-200 hover:border-crimson-300"
                }`}
              >
                <User
                  className={`w-12 h-12 mx-auto mb-4 ${
                    role === "hirer" ? "text-crimson-700" : "text-terrain-500"
                  }`}
                />
                <h3 className="font-bold text-lg mb-2">
                  {isNepali ? "रोजगारदाता" : "Hirer"}
                </h3>
                <p className="text-sm text-terrain-600">
                  {isNepali
                    ? "म कामदार खोज्दै छु"
                    : "I want to hire workers"}
                </p>
              </button>
            </div>
            {localizeError(errors.role?.message, isNepali) && (
              <p className="text-sm text-red-600 text-center">
                {localizeError(errors.role?.message, isNepali) ??
                  (isNepali
                    ? "कृपया भूमिका चयन गर्नुहोस्"
                    : "Please select a role")}
              </p>
            )}
          </motion.div>
        );
      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-mountain-900 mb-6">
              {isNepali ? "तपाईंको विवरण" : "Your Details"}
            </h2>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                {isNepali ? "पूरा नाम" : "Full Name"}
              </label>
              <Input
                {...register("fullName")}
                placeholder={isNepali ? "राम बहादुर" : "Ram Bahadur"}
              />
              {localizeError(errors.fullName?.message, isNepali) && (
                <p className="mt-1 text-xs text-red-600">
                  {localizeError(errors.fullName?.message, isNepali)}
                </p>
              )}
            </div>

            <div className="pt-4">
              <label className="block text-sm font-medium mb-3 text-mountain-900 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {isNepali ? "स्थान" : "Location"}
              </label>

              <div className="space-y-3">
                <select
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  {...register("provinceId", { valueAsNumber: true })}
                  defaultValue=""
                >
                  <option value="" disabled>
                    {isNepali ? "प्रदेश छान्नुहोस्" : "Select Province"}
                  </option>
                  {provinces.map((p) => (
                    <option key={p.id} value={p.id}>
                      {isNepali ? p.nameNp : p.nameEn}
                    </option>
                  ))}
                </select>
                {localizeError(errors.provinceId?.message, isNepali) && (
                  <p className="-mt-1 text-xs text-red-600">
                    {localizeError(errors.provinceId?.message, isNepali)}
                  </p>
                )}

                <select
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  {...register("districtId", { valueAsNumber: true })}
                  defaultValue=""
                  disabled={!provinceId}
                >
                  <option value="" disabled>
                    {isNepali ? "जिल्ला छान्नुहोस्" : "Select District"}
                  </option>
                  {provinceDistricts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {isNepali ? d.nameNp : d.nameEn}
                    </option>
                  ))}
                </select>
                {localizeError(errors.districtId?.message, isNepali) && (
                  <p className="-mt-1 text-xs text-red-600">
                    {localizeError(errors.districtId?.message, isNepali)}
                  </p>
                )}

                <select
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  {...register("localUnitId", { valueAsNumber: true })}
                  defaultValue=""
                  disabled={!districtId || localUnitsQuery.isLoading}
                >
                  <option value="" disabled>
                    {isNepali
                      ? "स्थानीय तह छान्नुहोस्"
                      : "Select Local Unit"}
                  </option>
                  {(localUnitsQuery.data || []).map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {isNepali ? u.name_np || u.name_en : u.name_en}
                    </option>
                  ))}
                </select>
                {localizeError(errors.localUnitId?.message, isNepali) && (
                  <p className="-mt-1 text-xs text-red-600">
                    {localizeError(errors.localUnitId?.message, isNepali)}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold text-mountain-900 mb-6">
              {isNepali ? "पेशागत विवरण" : "Professional Details"}
            </h2>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                {isNepali ? "कामको वर्ग" : "Job Category"}
              </label>
              <select
                className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                {...register("jobCategoryId", { valueAsNumber: true })}
                defaultValue=""
              >
                <option value="" disabled>
                  {isNepali ? "छान्नुहोस्" : "Select..."}
                </option>
                {(jobCategoriesQuery.data || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {isNepali ? cat.name_np : cat.name_en}
                  </option>
                ))}
              </select>
              {localizeError(errors.jobCategoryId?.message, isNepali) && (
                <p className="mt-1 text-xs text-red-600">
                  {localizeError(errors.jobCategoryId?.message, isNepali)}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                  {isNepali ? "अनुभव (वर्ष)" : "Experience (Yrs)"}
                </label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  placeholder="0"
                  {...register("experienceYrs", { valueAsNumber: true })}
                />
                {localizeError(errors.experienceYrs?.message, isNepali) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(errors.experienceYrs?.message, isNepali)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                  {isNepali ? "दैनिक ज्याला (रु)" : "Daily Rate (NPR)"}
                </label>
                <Input
                  type="number"
                  min={500}
                  max={10000}
                  placeholder="1000"
                  {...register("dailyRateNpr", { valueAsNumber: true })}
                />
                {localizeError(errors.dailyRateNpr?.message, isNepali) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(errors.dailyRateNpr?.message, isNepali)}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                {isNepali ? "आफ्नो बारेमा" : "About You"}
              </label>
              <textarea
                className="w-full flex min-h-[100px] rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                {...register("about")}
                placeholder={
                  isNepali
                    ? "तपाईंको अनुभव र सीपको बारेमा लेख्नुहोस्..."
                    : "Write about your experience and skills..."
                }
              />
              {localizeError(errors.about?.message, isNepali) && (
                <p className="mt-1 text-xs text-red-600">
                  {localizeError(errors.about?.message, isNepali)}
                </p>
              )}
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="mb-8">
        <Progress value={progress} className="h-2 mb-4" />
        <div className="flex justify-between text-xs font-medium text-terrain-500 uppercase tracking-wider">
          <span>{isNepali ? "सुरुवात" : "Start"}</span>
          <span>
            {isNepali
              ? `चरण ${step}/${totalSteps}`
              : `Step ${step} of ${totalSteps}`}
          </span>
        </div>
      </div>

      <Card className="border-terrain-200 shadow-sm">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

            {submitError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md"
              >
                {submitError}
              </motion.p>
            )}

            <div className="mt-8 flex gap-3">
              {step > 1 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={isSubmitting}
                >
                  {isNepali ? "पछाडि" : "Back"}
                </Button>
              )}
              {step === totalSteps ? (
                <Button
                  type="submit"
                  className="flex-[2]"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    isNepali ? "प्रतीक्षा गर्नुहोस्..." : "Please wait..."
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {isNepali ? "सम्पन्न गर्नुहोस्" : "Complete Setup"}
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="flex-[2]"
                  onClick={advance}
                  disabled={isSubmitting}
                >
                  {isNepali ? "अगाडि बढ्नुहोस्" : "Continue"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
