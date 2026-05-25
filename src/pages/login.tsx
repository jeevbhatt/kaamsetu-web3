import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUIStore, useAuthStore } from "../store";
import { Button, Card, CardContent, Input } from "../components/ui";
import { Phone, ArrowRight, Shield } from "lucide-react";
import { isSupabaseConfigured } from "../lib";

// ─── Schemas ───────────────────────────────────────────────────────────
// Three distinct sub-forms (phone, OTP, email), each gets its own schema
// so error messages stay tightly scoped and the resolver only validates
// the fields visible on the current step.

const phoneSchema = z.object({
  phone: z
    .string()
    .regex(
      /^9[678]\d{8}$/,
      "Enter a valid Nepal mobile number (98/97/96 + 8 digits)",
    ),
});

const otpSchema = z.object({
  otp: z.string().regex(/^\d{6}$/, "6-digit OTP required"),
});

const emailLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type PhoneFormValues = z.input<typeof phoneSchema>;
type OtpFormValues = z.input<typeof otpSchema>;
type EmailFormValues = z.input<typeof emailLoginSchema>;

// Lightweight EN→NE translation for the Zod messages this form raises.
// When react-i18next adoption lands (Week 3), this collapses into a key
// lookup. Keep it tiny on purpose — only the strings this file emits.
function localizeError(message: string | undefined, isNepali: boolean): string | null {
  if (!message) return null;
  if (!isNepali) return message;

  if (message.includes("Enter a valid Nepal mobile number")) {
    return "मान्य मोबाइल नम्बर प्रविष्ट गर्नुहोस् (९८/९७/९६ बाट सुरु हुने)";
  }
  if (message.includes("6-digit OTP required")) {
    return "६ अङ्कको OTP आवश्यक छ";
  }
  if (message.includes("Invalid email address")) {
    return "अवैध इमेल ठेगाना";
  }
  if (message.includes("Password must be at least 6 characters")) {
    return "पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्छ";
  }
  return message;
}

export default function LoginPage() {
  const { locale, setLocale } = useUIStore();
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();

  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [phoneE164, setPhoneE164] = useState(""); // captured between steps

  const phoneForm = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    mode: "onTouched",
    defaultValues: { phone: "" },
  });

  const otpForm = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    mode: "onTouched",
    defaultValues: { otp: "" },
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailLoginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });

  const ensureBackend = (): boolean => {
    if (backendConfigured) return true;
    setSubmitError(
      isNepali
        ? "लगइन सेवा अहिले अस्थायी रूपमा उपलब्ध छैन।"
        : "Login is temporarily unavailable.",
    );
    return false;
  };

  const handleSendOtp = async (values: PhoneFormValues) => {
    setSubmitError("");
    if (!ensureBackend()) return;

    setIsLoading(true);
    const otpSent = await login(values.phone);
    setIsLoading(false);

    if (!otpSent) {
      const rawError = useAuthStore.getState().authError ?? "";
      const isProviderDisabled =
        rawError.toLowerCase().includes("phone_provider_disabled") ||
        rawError.toLowerCase().includes("unsupported phone provider") ||
        rawError.toLowerCase().includes("phone otp is not enabled");
      setSubmitError(
        isProviderDisabled
          ? isNepali
            ? "SMS सेवा अहिले उपलब्ध छैन। कृपया इमेल लगइन प्रयोग गर्नुहोस्।"
            : "SMS login is not available right now. Please use email login."
          : rawError ||
              (isNepali
                ? "OTP पठाउन सकिएन। पछि पुनः प्रयास गर्नुहोस्।"
                : "Failed to send OTP. Please try again."),
      );
      return;
    }

    setPhoneE164(values.phone);
    setStep("otp");
  };

  const handleVerifyOtp = async (values: OtpFormValues) => {
    setSubmitError("");
    if (!ensureBackend()) return;

    setIsLoading(true);
    const isLoggedIn = await login(phoneE164, values.otp);
    setIsLoading(false);

    if (!isLoggedIn) {
      const rawError = useAuthStore.getState().authError ?? "";
      setSubmitError(
        rawError ||
          (isNepali
            ? "OTP प्रमाणिकरण असफल भयो। पुन: प्रयास गर्नुहोस्।"
            : "OTP verification failed. Please try again."),
      );
      return;
    }

    navigate({ to: "/profile" });
  };

  const handleEmailLogin = async (values: EmailFormValues) => {
    setSubmitError("");
    if (!ensureBackend()) return;

    setIsLoading(true);
    const { loginWithEmail } = useAuthStore.getState();
    const isLoggedIn = await loginWithEmail(values.email, values.password);
    setIsLoading(false);

    if (!isLoggedIn) {
      const rawError = useAuthStore.getState().authError ?? "";
      setSubmitError(
        rawError ||
          (isNepali
            ? "इमेल लगइन असफल भयो। पुन: प्रयास गर्नुहोस्।"
            : "Email login failed. Please try again."),
      );
      return;
    }

    navigate({ to: "/profile" });
  };

  const switchToEmail = () => {
    setAuthMethod("email");
    setSubmitError("");
    phoneForm.reset();
    otpForm.reset();
  };

  const switchToPhone = () => {
    setAuthMethod("phone");
    setStep("phone");
    setSubmitError("");
    emailForm.reset();
  };

  const backToPhoneStep = () => {
    setStep("phone");
    setSubmitError("");
    otpForm.reset();
  };

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setLocale("ne")}
          className={`px-3 py-1 text-sm rounded-full ${locale === "ne" ? "bg-crimson-700 text-white" : "bg-terrain-200"}`}
        >
          नेपाली
        </button>
        <button
          onClick={() => setLocale("en")}
          className={`px-3 py-1 text-sm rounded-full ${locale === "en" ? "bg-crimson-700 text-white" : "bg-terrain-200"}`}
        >
          English
        </button>
      </div>

      <div className="text-center mb-8">
        <img src="/logo.png" alt="Shram Sewa" className="h-16 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-mountain-900">
          {isNepali ? "श्रम सेवा" : "Shram Sewa"}
        </h1>
      </div>

      <div className="flex justify-center gap-2 mb-4 border-b border-terrain-200">
        <button
          onClick={switchToPhone}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${authMethod === "phone" ? "text-crimson-700 border-b-2 border-crimson-700" : "text-terrain-500 hover:text-mountain-900"}`}
        >
          {isNepali ? "मोबाइल नम्बर" : "Mobile Phone"}
        </button>
        <button
          onClick={switchToEmail}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${authMethod === "email" ? "text-crimson-700 border-b-2 border-crimson-700" : "text-terrain-500 hover:text-mountain-900"}`}
        >
          {isNepali ? "इमेल" : "Email"}
        </button>
      </div>

      <Card>
        <CardContent className="p-6">
          {!backendConfigured && (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {isNepali
                ? "लगइन सेवा अहिले उपलब्ध छैन।"
                : "Login is currently unavailable."}
            </p>
          )}

          {authMethod === "email" ? (
            <form
              onSubmit={emailForm.handleSubmit(handleEmailLogin)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {isNepali ? "इमेल" : "Email"}
                </label>
                <Input
                  type="email"
                  placeholder="user@example.com"
                  {...emailForm.register("email")}
                />
                {localizeError(
                  emailForm.formState.errors.email?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(
                      emailForm.formState.errors.email?.message,
                      isNepali,
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {isNepali ? "पासवर्ड" : "Password"}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  {...emailForm.register("password")}
                />
                {localizeError(
                  emailForm.formState.errors.password?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(
                      emailForm.formState.errors.password?.message,
                      isNepali,
                    )}
                  </p>
                )}
              </div>
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  !backendConfigured ||
                  emailForm.formState.isSubmitting
                }
              >
                {isLoading ? "..." : isNepali ? "लगइन गर्नुहोस्" : "Sign In"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
          ) : step === "phone" ? (
            <form
              onSubmit={phoneForm.handleSubmit(handleSendOtp)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  <Phone className="w-4 h-4 inline mr-1" />
                  {isNepali ? "मोबाइल" : "Mobile"}
                </label>
                <div className="flex">
                  <span className="px-3 py-2 bg-terrain-100 border border-r-0 rounded-l-md">
                    +977
                  </span>
                  <Input
                    inputMode="numeric"
                    placeholder="98XXXXXXXX"
                    className="rounded-l-none"
                    maxLength={10}
                    {...phoneForm.register("phone", {
                      // Sanitize input as the user types so paste / autofill
                      // can't slip non-digits past the regex.
                      setValueAs: (value: string) =>
                        (value ?? "").replace(/\D/g, "").slice(0, 10),
                    })}
                  />
                </div>
                {localizeError(
                  phoneForm.formState.errors.phone?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(
                      phoneForm.formState.errors.phone?.message,
                      isNepali,
                    )}
                  </p>
                )}
              </div>
              {submitError && (
                <p className="text-sm text-red-600">{submitError}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  !backendConfigured ||
                  phoneForm.formState.isSubmitting
                }
              >
                {isLoading ? (
                  "..."
                ) : (
                  <>
                    {isNepali ? "OTP पठाउनुहोस्" : "Send OTP"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form
              onSubmit={otpForm.handleSubmit(handleVerifyOtp)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  <Shield className="w-4 h-4 inline mr-1" />
                  OTP
                </label>
                <Input
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  {...otpForm.register("otp", {
                    setValueAs: (value: string) =>
                      (value ?? "").replace(/\D/g, "").slice(0, 6),
                  })}
                />
                {localizeError(
                  otpForm.formState.errors.otp?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600 text-center">
                    {localizeError(
                      otpForm.formState.errors.otp?.message,
                      isNepali,
                    )}
                  </p>
                )}
              </div>
              {submitError && (
                <p className="text-sm text-red-600 text-center">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={
                  isLoading ||
                  !backendConfigured ||
                  otpForm.formState.isSubmitting
                }
              >
                {isLoading ? "..." : isNepali ? "प्रमाणित" : "Verify"}
              </Button>
              <button
                type="button"
                onClick={backToPhoneStep}
                className="w-full text-sm text-terrain-500"
              >
                {isNepali ? "नम्बर बदल्नुहोस्" : "Change number"}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
