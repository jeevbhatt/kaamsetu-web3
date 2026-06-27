import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUIStore, useAuthStore } from "../store";
import { Button, Card, CardContent, Input } from "../components/ui";
import {
  Phone,
  ArrowRight,
  Shield,
  Mail,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { getAuthRedirectUrl, isSupabaseConfigured, translateError } from "../lib";
import { authApi } from "@shram-sewa/shared";

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

// Email magic-link fallback: just an email, no password.
const emailLinkSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type PhoneFormValues = z.input<typeof phoneSchema>;
type OtpFormValues = z.input<typeof otpSchema>;
type EmailFormValues = z.input<typeof emailLoginSchema>;
type EmailLinkFormValues = z.input<typeof emailLinkSchema>;

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

function generatePassword() {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%*?",
  ];
  const all = groups.join("");
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  const required = groups.map((group, index) =>
    group.charAt((bytes[index] ?? 0) % group.length),
  );
  const rest = Array.from(bytes.slice(required.length, 12)).map(
    (value) => all.charAt(value % all.length),
  );
  return [...required, ...rest]
    .sort(() => {
      const shuffleBytes = new Uint32Array(1);
      crypto.getRandomValues(shuffleBytes);
      return (shuffleBytes[0] ?? 0) - 2 ** 31;
    })
    .join("");
}

// Trigger the browser's "save password?" prompt (Google Password Manager /
// Chrome, Safari Keychain, etc.) after a successful email sign-in or sign-up.
// In an SPA the form submit is intercepted by React + a fetch to Supabase, so
// the browser's passive heuristics usually MISS the credential. The Credential
// Management API stores it explicitly, which surfaces the save prompt.
async function savePasswordCredential(email: string, password: string) {
  try {
    if (typeof window === "undefined") return;
    const PasswordCredentialCtor = (
      window as unknown as {
        PasswordCredential?: new (data: {
          id: string;
          password: string;
          name?: string;
        }) => Credential;
      }
    ).PasswordCredential;
    if (PasswordCredentialCtor && navigator.credentials?.store) {
      const credential = new PasswordCredentialCtor({
        id: email,
        password,
        name: email,
      });
      await navigator.credentials.store(credential);
    }
  } catch {
    // Best-effort: unsupported browser or user dismissal — ignore.
  }
}

export default function LoginPage() {
  const { locale, setLocale } = useUIStore();
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();

  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  // "email-link" is the SMS-failure escape hatch: a magic link sent to email.
  const [step, setStep] = useState<"phone" | "otp" | "email-link">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [phoneE164, setPhoneE164] = useState(""); // captured between steps
  const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
  // Email tab sub-mode: sign in to an existing account, or register a new one.
  const [emailMode, setEmailMode] = useState<"signin" | "register">("signin");
  // Friendly info banner (e.g. "check your email to confirm" / reset sent).
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  // Set when a sign-in fails because the email isn't confirmed yet — drives
  // the "Resend confirmation email" affordance.
  const [confirmPendingEmail, setConfirmPendingEmail] = useState<string | null>(
    null,
  );
  const [isResending, setIsResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const emailLinkForm = useForm<EmailLinkFormValues>({
    resolver: zodResolver(emailLinkSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
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
    setInfoMessage(null);
    setConfirmPendingEmail(null);
    if (!ensureBackend()) return;

    setIsLoading(true);
    const { loginWithEmail } = useAuthStore.getState();
    const isLoggedIn = await loginWithEmail(values.email, values.password);
    setIsLoading(false);

    if (!isLoggedIn) {
      const rawError = useAuthStore.getState().authError ?? "";
      // Unconfirmed email → surface a clear message + a resend option instead
      // of the raw "Email not confirmed" string.
      if (/not confirmed|email_not_confirmed/i.test(rawError)) {
        setConfirmPendingEmail(values.email);
        setSubmitError(
          isNepali
            ? "तपाईंको इमेल अझै पुष्टि भएको छैन। इनबक्स (र स्पाम) जाँच गर्नुहोस्, वा तलको बटनबाट पुष्टिकरण इमेल पुनः पठाउनुहोस्।"
            : "Your email isn't confirmed yet. Check your inbox (and spam) for the link, or resend it below.",
        );
        return;
      }
      setSubmitError(
        rawError ||
          (isNepali
            ? "इमेल लगइन असफल भयो। पुन: प्रयास गर्नुहोस्।"
            : "Email login failed. Please try again."),
      );
      return;
    }

    await savePasswordCredential(values.email, values.password);
    navigate({ to: "/profile" });
  };

  const handleResendConfirmation = async () => {
    if (!confirmPendingEmail || !ensureBackend()) return;
    setIsResending(true);
    setSubmitError("");
    try {
      await authApi.resendConfirmation(
        confirmPendingEmail,
        getAuthRedirectUrl("/profile"),
      );
      setInfoMessage(
        isNepali
          ? `पुष्टिकरण इमेल ${confirmPendingEmail} मा पुनः पठाइयो।`
          : `Confirmation email resent to ${confirmPendingEmail}.`,
      );
    } catch (error) {
      setSubmitError(translateError(error, { isNepali, context: "login" }));
    } finally {
      setIsResending(false);
    }
  };

  // Register a brand-new account with email + password. On success the
  // requireProfile guard on /profile auto-routes them to /onboarding.
  const handleEmailRegister = async (values: EmailFormValues) => {
    setSubmitError("");
    setInfoMessage(null);
    if (!ensureBackend()) return;

    setIsLoading(true);
    const { registerWithEmail } = useAuthStore.getState();
    const result = await registerWithEmail(
      values.email,
      values.password,
      getAuthRedirectUrl("/profile"),
    );
    setIsLoading(false);

    if (result.kind === "session") {
      // Account created + signed in → offer to save the new credential.
      await savePasswordCredential(values.email, values.password);
      navigate({ to: "/profile" });
      return;
    }
    if (result.kind === "confirm") {
      setInfoMessage(
        isNepali
          ? "खाता बनाइयो। साइन इन गर्न आफ्नो इमेलमा पठाइएको पुष्टिकरण लिंक क्लिक गर्नुहोस्।"
          : "Account created. Check your email and click the confirmation link to sign in.",
      );
      return;
    }
    // kind === "error"
    setSubmitError(
      result.message ||
        (isNepali
          ? "दर्ता असफल भयो। पुन: प्रयास गर्नुहोस्।"
          : "Registration failed. Please try again."),
    );
  };

  // Forgot-password: emails a recovery link that lands on /reset-password,
  // where the user sets a new password. Reuses the email already typed in
  // the sign-in form.
  const handleForgotPassword = async () => {
    setSubmitError("");
    setInfoMessage(null);
    if (!ensureBackend()) return;

    const email = emailForm.getValues("email").trim();
    const emailOk = z.string().email().safeParse(email).success;
    if (!emailOk) {
      emailForm.setError("email", {
        message: "Invalid email address",
      });
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(
        email,
        getAuthRedirectUrl("/reset-password"),
      );
      setInfoMessage(
        isNepali
          ? `पासवर्ड रिसेट लिंक ${email} मा पठाइयो। आफ्नो इमेल जाँच गर्नुहोस्।`
          : `Password reset link sent to ${email}. Please check your email.`,
      );
    } catch (error) {
      setSubmitError(translateError(error, { isNepali, context: "login" }));
    } finally {
      setIsLoading(false);
    }
  };

  // SMS-failure escape hatch. Sends a one-click sign-in link to the user's
  // email so they can get in even if no SMS provider could deliver the code.
  const handleSendMagicLink = async (values: EmailLinkFormValues) => {
    setSubmitError("");
    if (!ensureBackend()) return;

    setIsLoading(true);
    try {
      await authApi.requestEmailMagicLink(
        values.email,
        getAuthRedirectUrl("/profile"),
      );
      setMagicLinkSentTo(values.email);
    } catch (error) {
      setSubmitError(translateError(error, { isNepali, context: "login" }));
    } finally {
      setIsLoading(false);
    }
  };

  const switchToEmailLink = () => {
    setStep("email-link");
    setSubmitError("");
    setInfoMessage(null);
    setMagicLinkSentTo(null);
    emailLinkForm.reset();
  };

  const switchToEmail = () => {
    setAuthMethod("email");
    setSubmitError("");
    setInfoMessage(null);
    phoneForm.reset();
    otpForm.reset();
  };

  const switchToPhone = () => {
    setAuthMethod("phone");
    setStep("phone");
    setSubmitError("");
    setInfoMessage(null);
    setMagicLinkSentTo(null);
    emailForm.reset();
  };

  // Toggle between the Email tab's "sign in" and "register" sub-modes.
  const switchEmailMode = (mode: "signin" | "register") => {
    setEmailMode(mode);
    setSubmitError("");
    setInfoMessage(null);
    setConfirmPendingEmail(null);
    emailForm.clearErrors();
  };

  const handleGeneratePassword = () => {
    const password = generatePassword();
    emailForm.setValue("password", password, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setShowPassword(true);
  };

  const backToPhoneStep = () => {
    setStep("phone");
    setSubmitError("");
    setInfoMessage(null);
    setMagicLinkSentTo(null);
    otpForm.reset();
  };

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="flex justify-center gap-2 mb-8">
        {/* type="button" is critical: a bare <button> in a React tree
            defaults to type=submit, which would submit the nearest
            ancestor <form> on click. These switchers sit ABOVE the
            forms today so it's currently harmless, but the explicit
            attribute keeps them safe if the layout ever changes. */}
        <button
          type="button"
          onClick={() => setLocale("ne")}
          className={`px-3 py-1 text-sm rounded-full ${locale === "ne" ? "bg-crimson-700 text-white" : "bg-terrain-200"}`}
        >
          नेपाली
        </button>
        <button
          type="button"
          onClick={() => setLocale("en")}
          className={`px-3 py-1 text-sm rounded-full ${locale === "en" ? "bg-crimson-700 text-white" : "bg-terrain-200"}`}
        >
          English
        </button>
      </div>

      <div className="text-center mb-6">
        <img src="/logo.png" alt="Shram Sewa" className="h-16 w-auto mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-mountain-900">
          {isNepali ? "श्रम सेवा" : "Shram Sewa"}
        </h1>
        <p className="mt-2 text-sm text-terrain-500">
          {isNepali
            ? "तपाईंको मोबाइल नम्बरमा OTP पठाई पुष्टि गर्नेछौं"
            : "We'll text you a 6-digit OTP to verify"}
        </p>
      </div>

      <div className="flex justify-center gap-2 mb-4 border-b border-terrain-200">
        <button
          type="button"
          onClick={switchToPhone}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${authMethod === "phone" ? "text-crimson-700 border-b-2 border-crimson-700" : "text-terrain-500 hover:text-mountain-900"}`}
        >
          {isNepali ? "मोबाइल नम्बर" : "Mobile Phone"}
        </button>
        <button
          type="button"
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
            <>
              {/* Sign in | Register sub-toggle. Sign-in uses an existing
                  account; Register creates a new email+password account. */}
              <div className="grid grid-cols-2 gap-1 mb-5 rounded-lg bg-terrain-100 p-1">
                <button
                  type="button"
                  onClick={() => switchEmailMode("signin")}
                  className={`rounded-md py-1.5 text-sm font-medium transition-colors ${emailMode === "signin" ? "bg-white text-crimson-700 shadow-sm" : "text-terrain-500 hover:text-mountain-900"}`}
                >
                  {isNepali ? "साइन इन" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => switchEmailMode("register")}
                  className={`rounded-md py-1.5 text-sm font-medium transition-colors ${emailMode === "register" ? "bg-white text-crimson-700 shadow-sm" : "text-terrain-500 hover:text-mountain-900"}`}
                >
                  {isNepali ? "दर्ता गर्नुहोस्" : "Register"}
                </button>
              </div>

              {infoMessage && (
                <p className="mb-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{infoMessage}</span>
                </p>
              )}

              <form
                onSubmit={emailForm.handleSubmit(
                  emailMode === "register"
                    ? handleEmailRegister
                    : handleEmailLogin,
                )}
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
                    autoFocus
                    autoComplete="email"
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium">
                      {isNepali ? "पासवर्ड" : "Password"}
                    </label>
                    {emailMode === "register" ? (
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="inline-flex items-center gap-1 text-xs font-medium text-crimson-700 hover:text-crimson-800"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isNepali ? "पासवर्ड बनाउनुहोस्" : "Generate"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={isLoading || !backendConfigured}
                        className="text-xs text-crimson-700 hover:underline disabled:opacity-50"
                      >
                        {isNepali ? "पासवर्ड बिर्सनुभयो?" : "Forgot password?"}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      autoComplete={
                        emailMode === "register"
                          ? "new-password"
                          : "current-password"
                      }
                      className="pr-10"
                      {...emailForm.register("password")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-terrain-500 hover:text-mountain-900"
                      aria-label={
                        showPassword
                          ? isNepali
                            ? "पासवर्ड लुकाउनुहोस्"
                            : "Hide password"
                          : isNepali
                            ? "पासवर्ड देखाउनुहोस्"
                            : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
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
                  {emailMode === "register" && (
                    <p className="mt-1 text-xs text-terrain-500">
                      {isNepali
                        ? "कम्तीमा ६ अक्षरको पासवर्ड बनाउनुहोस्।"
                        : "Choose a password with at least 6 characters."}
                    </p>
                  )}
                </div>
                {submitError && (
                  <p className="text-sm text-red-600">{submitError}</p>
                )}
                {confirmPendingEmail && (
                  <button
                    type="button"
                    onClick={() => void handleResendConfirmation()}
                    disabled={isResending || !backendConfigured}
                    className="w-full rounded-md border border-crimson-200 bg-crimson-50/50 py-2 text-sm font-medium text-crimson-700 hover:bg-crimson-50 disabled:opacity-60"
                  >
                    {isResending
                      ? isNepali
                        ? "पठाउँदै..."
                        : "Resending..."
                      : isNepali
                        ? "पुष्टिकरण इमेल पुनः पठाउनुहोस्"
                        : "Resend confirmation email"}
                  </button>
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
                  {isLoading
                    ? "..."
                    : emailMode === "register"
                      ? isNepali
                        ? "खाता बनाउनुहोस्"
                        : "Create account"
                      : isNepali
                        ? "लगइन गर्नुहोस्"
                        : "Sign In"}
                  {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
                </Button>
              </form>
            </>
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
                    autoFocus
                    autoComplete="tel-national"
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
          ) : step === "otp" ? (
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
                  autoFocus
                  autoComplete="one-time-code"
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

              {/* SMS-failure escape hatch: if the code never arrives (Sparrow
                  + Twilio both failed, or carrier filtered it), let the user
                  sign in via an email magic link instead. */}
              <div className="pt-2 border-t border-terrain-200 text-center">
                <p className="text-xs text-terrain-500 mb-1.5">
                  {isNepali
                    ? "कोड आएन?"
                    : "Didn't get the code?"}
                </p>
                <button
                  type="button"
                  onClick={switchToEmailLink}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-crimson-700 hover:text-crimson-800"
                >
                  <Mail className="w-4 h-4" />
                  {isNepali
                    ? "इमेल लिंक मार्फत साइन इन गर्नुहोस्"
                    : "Sign in with an email link"}
                </button>
              </div>
            </form>
          ) : (
            /* ── email-link step (SMS fallback) ── */
            magicLinkSentTo ? (
              <div className="text-center space-y-3 py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-lg font-semibold text-mountain-900">
                  {isNepali ? "इमेल जाँच गर्नुहोस्" : "Check your email"}
                </h2>
                <p className="text-sm text-terrain-500">
                  {isNepali
                    ? `हामीले ${magicLinkSentTo} मा साइन-इन लिंक पठायौं। लिंकमा क्लिक गरी साइन इन गर्नुहोस्।`
                    : `We sent a sign-in link to ${magicLinkSentTo}. Click it to sign in.`}
                </p>
                <button
                  type="button"
                  onClick={backToPhoneStep}
                  className="text-sm text-terrain-500 hover:text-mountain-900"
                >
                  {isNepali ? "मोबाइलमा फर्कनुहोस्" : "Back to mobile login"}
                </button>
              </div>
            ) : (
              <form
                onSubmit={emailLinkForm.handleSubmit(handleSendMagicLink)}
                noValidate
                className="space-y-4"
              >
                <p className="text-sm text-terrain-500">
                  {isNepali
                    ? "तपाईंको इमेल प्रविष्ट गर्नुहोस्। हामी एक-क्लिक साइन-इन लिंक पठाउनेछौं।"
                    : "Enter your email and we'll send you a one-click sign-in link."}
                </p>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    <Mail className="w-4 h-4 inline mr-1" />
                    {isNepali ? "इमेल" : "Email"}
                  </label>
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    autoFocus
                    autoComplete="email"
                    {...emailLinkForm.register("email")}
                  />
                  {localizeError(
                    emailLinkForm.formState.errors.email?.message,
                    isNepali,
                  ) && (
                    <p className="mt-1 text-xs text-red-600">
                      {localizeError(
                        emailLinkForm.formState.errors.email?.message,
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
                    emailLinkForm.formState.isSubmitting
                  }
                >
                  {isLoading
                    ? "..."
                    : isNepali
                      ? "साइन-इन लिंक पठाउनुहोस्"
                      : "Send sign-in link"}
                </Button>
                <button
                  type="button"
                  onClick={backToPhoneStep}
                  className="w-full text-sm text-terrain-500"
                >
                  {isNepali ? "मोबाइलमा फर्कनुहोस्" : "Back to mobile login"}
                </button>
              </form>
            )
          )}
        </CardContent>
      </Card>

      {/* Registration note. Phone OTP is passwordless so signing in IS
          registering; the Email tab has an explicit Register sub-toggle.
          Onboarding sets up the profile after the account exists. */}
      <div className="mt-5 text-center">
        <p className="text-sm text-terrain-500">
          {isNepali ? "श्रम सेवामा नयाँ हुनुहुन्छ?" : "New to Shram Sewa?"}
        </p>
        <p className="mt-1 text-sm text-mountain-700">
          {authMethod === "email"
            ? isNepali
              ? "माथिको “दर्ता गर्नुहोस्” ट्याबबाट इमेल र पासवर्डले खाता बनाउनुहोस् — त्यसपछि प्रोफाइल सेटअप हुन्छ।"
              : "Use the “Register” tab above to create an account with your email and password — then set up your profile."
            : isNepali
              ? "माथिको मोबाइल साइन-इनले स्वतः खाता बनाउँछ — त्यसपछि तपाईं कामदारको रूपमा दर्ता गर्न सक्नुहुन्छ।"
              : "Signing in with your mobile above creates your account automatically — then you can register as a worker."}
        </p>
        <Link
          to="/how-it-works"
          className="mt-2 inline-block text-sm font-medium text-crimson-700 hover:text-crimson-800"
        >
          {isNepali ? "यो कसरी काम गर्छ?" : "How does this work?"}
        </Link>
      </div>
    </div>
  );
}
