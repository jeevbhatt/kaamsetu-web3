import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, useUIStore } from "../store";
import { authApi, workerProfilesApi, provinces, getDistrictsByProvince } from "@shram-sewa/shared";
import { Card, CardContent, Button, Input, Progress } from "../components/ui";
import { User, Briefcase, MapPin, ChevronRight, Check } from "lucide-react";
import {
  useJobCategories,
  useLocalUnits,
} from "../hooks";

export default function OnboardingPage() {
  const { user, isProfileComplete, initialize } = useAuthStore();
  const { locale } = useUIStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<"worker" | "hirer" | null>(null);
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [provinceId, setProvinceId] = useState<number | null>(null);
  const [districtId, setDistrictId] = useState<number | null>(null);
  const [localUnitId, setLocalUnitId] = useState<number | null>(null);
  
  // Worker-specific state
  const [jobCategoryId, setJobCategoryId] = useState<number | null>(null);
  const [experienceYrs, setExperienceYrs] = useState<string>("");
  const [dailyRateNpr, setDailyRateNpr] = useState<string>("");
  const [about, setAbout] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobCategoriesQuery = useJobCategories(true);
  const localUnitsQuery = useLocalUnits(districtId || undefined);

  const provinceDistricts = provinceId ? getDistrictsByProvince(provinceId) : [];

  useEffect(() => {
    if (isProfileComplete()) {
      navigate({ to: "/profile", replace: true });
    }
  }, [isProfileComplete, navigate]);

  const totalSteps = role === "worker" ? 3 : 2;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step === 1 && !role) {
      setError(isNepali ? "कृपया भूमिका चयन गर्नुहोस्" : "Please select a role");
      return;
    }
    if (step === 2) {
      if (!fullName.trim() || !provinceId || !districtId || !localUnitId) {
        setError(isNepali ? "सबै विवरणहरू भर्नुहोस्" : "Please fill in all details");
        return;
      }
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleSubmit = async () => {
    if (role === "worker" && (!jobCategoryId || !dailyRateNpr)) {
      setError(isNepali ? "पेशा र ज्याला आवश्यक छ" : "Profession and rate are required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Update User Metadata
      await (authApi as any).updateUser({
        data: {
          full_name: fullName,
          role: role,
        },
      });

      // 2. If Worker, update Worker Profile
      if (role === "worker" && user?.id) {
        await (workerProfilesApi as any).upsertByUserId(user.id, {
          jobCategoryId: jobCategoryId!,
          provinceId: provinceId!,
          districtId: districtId!,
          localUnitId: localUnitId!,
          wardNo: 1, // Default to ward 1 if not asked
          experienceYrs: parseInt(experienceYrs) || 0,
          dailyRateNpr: parseInt(dailyRateNpr) || 0,
          about: about.trim(),
        });
      }

      await initialize(); // Refresh auth store to update user data
      navigate({ to: "/profile", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred during setup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
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
                onClick={() => setRole("worker")}
                className={`p-6 rounded-2xl border-2 text-center transition-all ${role === "worker" ? "border-crimson-700 bg-crimson-50" : "border-terrain-200 hover:border-crimson-300"}`}
              >
                <Briefcase className={`w-12 h-12 mx-auto mb-4 ${role === "worker" ? "text-crimson-700" : "text-terrain-500"}`} />
                <h3 className="font-bold text-lg mb-2">{isNepali ? "कामदार" : "Worker"}</h3>
                <p className="text-sm text-terrain-600">{isNepali ? "म काम खोज्दै छु" : "I am looking for work"}</p>
              </button>
              <button
                onClick={() => setRole("hirer")}
                className={`p-6 rounded-2xl border-2 text-center transition-all ${role === "hirer" ? "border-crimson-700 bg-crimson-50" : "border-terrain-200 hover:border-crimson-300"}`}
              >
                <User className={`w-12 h-12 mx-auto mb-4 ${role === "hirer" ? "text-crimson-700" : "text-terrain-500"}`} />
                <h3 className="font-bold text-lg mb-2">{isNepali ? "रोजगारदाता" : "Hirer"}</h3>
                <p className="text-sm text-terrain-600">{isNepali ? "म कामदार खोज्दै छु" : "I want to hire workers"}</p>
              </button>
            </div>
          </motion.div>
        );
      case 2:
        return (
          <motion.div
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={isNepali ? "राम बहादुर" : "Ram Bahadur"}
              />
            </div>

            <div className="pt-4">
              <label className="block text-sm font-medium mb-3 text-mountain-900 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> {isNepali ? "स्थान" : "Location"}
              </label>
              
              <div className="space-y-3">
                <select 
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  value={provinceId || ""}
                  onChange={(e) => setProvinceId(Number(e.target.value))}
                >
                  <option value="" disabled>{isNepali ? "प्रदेश छान्नुहोस्" : "Select Province"}</option>
                  {provinces.map((p: any) => (
                    <option key={p.id} value={p.id}>{isNepali ? p.nameNp : p.nameEn}</option>
                  ))}
                </select>

                <select 
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  value={districtId || ""}
                  onChange={(e) => setDistrictId(Number(e.target.value))}
                  disabled={!provinceId}
                >
                  <option value="" disabled>{isNepali ? "जिल्ला छान्नुहोस्" : "Select District"}</option>
                  {provinceDistricts.map((d: any) => (
                    <option key={d.id} value={d.id}>{isNepali ? d.nameNp : d.nameEn}</option>
                  ))}
                </select>

                <select 
                  className="w-full flex h-10 rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                  value={localUnitId || ""}
                  onChange={(e) => setLocalUnitId(Number(e.target.value))}
                  disabled={!districtId || localUnitsQuery.isLoading}
                >
                  <option value="" disabled>{isNepali ? "स्थानीय तह छान्नुहोस्" : "Select Local Unit"}</option>
                  {(localUnitsQuery.data || []).map((u: any) => (
                    <option key={u.id} value={u.id}>{isNepali ? u.name_np || u.name_en : u.name_en}</option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>
        );
      case 3:
        return (
          <motion.div
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
                value={jobCategoryId || ""}
                onChange={(e) => setJobCategoryId(Number(e.target.value))}
              >
                <option value="" disabled>{isNepali ? "छान्नुहोस्" : "Select..."}</option>
                {(jobCategoriesQuery.data || []).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {isNepali ? cat.name_np : cat.name_en}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                  {isNepali ? "अनुभव (वर्ष)" : "Experience (Yrs)"}
                </label>
                <Input
                  type="number"
                  value={experienceYrs}
                  onChange={(e) => setExperienceYrs(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                  {isNepali ? "दैनिक ज्याला (रु)" : "Daily Rate (NPR)"}
                </label>
                <Input
                  type="number"
                  value={dailyRateNpr}
                  onChange={(e) => setDailyRateNpr(e.target.value)}
                  placeholder="1000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-mountain-900">
                {isNepali ? "आफ्नो बारेमा" : "About You"}
              </label>
              <textarea
                className="w-full flex min-h-[100px] rounded-md border border-terrain-200 bg-white px-3 py-2 text-sm"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder={isNepali ? "तपाईंको अनुभव र सीपको बारेमा लेख्नुहोस्..." : "Write about your experience and skills..."}
              />
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
          <span>{isNepali ? `चरण ${step}/${totalSteps}` : `Step ${step} of ${totalSteps}`}</span>
        </div>
      </div>

      <Card className="border-terrain-200 shadow-sm">
        <CardContent className="p-6 md:p-8">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>

          {error && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-md"
            >
              {error}
            </motion.p>
          )}

          <div className="mt-8 flex gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(step - 1)}
                disabled={isSubmitting}
              >
                {isNepali ? "पछाडि" : "Back"}
              </Button>
            )}
            <Button
              className="flex-[2]"
              onClick={step === totalSteps ? handleSubmit : handleNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                isNepali ? "प्रतीक्षा गर्नुहोस्..." : "Please wait..."
              ) : step === totalSteps ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {isNepali ? "सम्पन्न गर्नुहोस्" : "Complete Setup"}
                </>
              ) : (
                <>
                  {isNepali ? "अगाडि बढ्नुहोस्" : "Continue"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
