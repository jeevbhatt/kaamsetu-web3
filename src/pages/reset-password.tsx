import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUIStore } from "../store";
import { Button, Card, CardContent, Input } from "../components/ui";
import { Lock, CheckCircle2, ArrowRight } from "lucide-react";
import { authApi } from "@shram-sewa/shared";
import { isSupabaseConfigured, translateError } from "../lib";

// The reset email's recovery link lands here. Supabase's detectSessionInUrl
// auto-exchanges the token in the URL hash for a (recovery) session, after
// which updateUser({ password }) can set the new password.
const resetSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm: z.string().min(6, "Password must be at least 6 characters"),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type ResetFormValues = z.input<typeof resetSchema>;

function localizeError(
  message: string | undefined,
  isNepali: boolean,
): string | null {
  if (!message) return null;
  if (!isNepali) return message;
  if (message.includes("Password must be at least 6 characters")) {
    return "पासवर्ड कम्तीमा ६ अक्षरको हुनुपर्छ";
  }
  if (message.includes("Passwords do not match")) {
    return "पासवर्डहरू मेल खाँदैनन्";
  }
  return message;
}

export default function ResetPasswordPage() {
  const { locale } = useUIStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();

  // "checking" until we know whether a recovery session exists.
  const [sessionState, setSessionState] = useState<
    "checking" | "ready" | "missing"
  >("checking");
  const [submitError, setSubmitError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    mode: "onTouched",
    defaultValues: { password: "", confirm: "" },
  });

  // Detect the recovery session. detectSessionInUrl parses the hash on load,
  // but it's async — so we check getSession() now AND subscribe to auth
  // changes (PASSWORD_RECOVERY / SIGNED_IN) in case the exchange lands later.
  useEffect(() => {
    if (!backendConfigured) {
      setSessionState("missing");
      return;
    }

    let active = true;
    let unsub: (() => void) | undefined;

    authApi
      .getSession()
      .then((session) => {
        if (!active) return;
        if (session) setSessionState("ready");
      })
      .catch(() => {
        /* fall through to the listener / missing state */
      });

    const { data } = authApi.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setSessionState("ready");
    });
    unsub = data?.subscription?.unsubscribe?.bind(data.subscription);

    // If nothing established a session within a short grace window, treat the
    // link as expired/invalid so the user isn't stuck on a spinner.
    const timer = setTimeout(() => {
      if (active) {
        setSessionState((prev) => (prev === "checking" ? "missing" : prev));
      }
    }, 2500);

    return () => {
      active = false;
      clearTimeout(timer);
      unsub?.();
    };
  }, [backendConfigured]);

  const onSubmit = async (values: ResetFormValues) => {
    setSubmitError("");
    setIsLoading(true);
    try {
      await authApi.updatePassword(values.password);
      setDone(true);
    } catch (error) {
      setSubmitError(translateError(error, { isNepali, context: "login" }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto py-8">
      <div className="text-center mb-6">
        <img
          src="/logo.png"
          alt="Shram Sewa"
          className="h-16 w-auto mx-auto mb-4"
        />
        <h1 className="text-2xl font-bold text-mountain-900">
          {isNepali ? "नयाँ पासवर्ड सेट गर्नुहोस्" : "Set a new password"}
        </h1>
      </div>

      <Card>
        <CardContent className="p-6">
          {done ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <p className="text-sm text-terrain-600">
                {isNepali
                  ? "तपाईंको पासवर्ड अपडेट भयो।"
                  : "Your password has been updated."}
              </p>
              <Button
                className="w-full"
                onClick={() => navigate({ to: "/profile" })}
              >
                {isNepali ? "जारी राख्नुहोस्" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          ) : sessionState === "checking" ? (
            <p className="text-center text-sm text-terrain-500 py-4">
              {isNepali ? "लिंक जाँच गर्दै…" : "Verifying your link…"}
            </p>
          ) : sessionState === "missing" ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-terrain-600">
                {isNepali
                  ? "यो रिसेट लिंक अवैध वा म्याद सकिएको छ। कृपया लगइन पृष्ठबाट फेरि अनुरोध गर्नुहोस्।"
                  : "This reset link is invalid or has expired. Please request a new one from the login page."}
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => navigate({ to: "/login" })}
              >
                {isNepali ? "लगइनमा जानुहोस्" : "Go to login"}
              </Button>
            </div>
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  <Lock className="w-4 h-4 inline mr-1" />
                  {isNepali ? "नयाँ पासवर्ड" : "New password"}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoFocus
                  autoComplete="new-password"
                  {...form.register("password")}
                />
                {localizeError(
                  form.formState.errors.password?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(
                      form.formState.errors.password?.message,
                      isNepali,
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {isNepali ? "पासवर्ड पुष्टि गर्नुहोस्" : "Confirm password"}
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...form.register("confirm")}
                />
                {localizeError(
                  form.formState.errors.confirm?.message,
                  isNepali,
                ) && (
                  <p className="mt-1 text-xs text-red-600">
                    {localizeError(
                      form.formState.errors.confirm?.message,
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
                disabled={isLoading || form.formState.isSubmitting}
              >
                {isLoading
                  ? "..."
                  : isNepali
                    ? "पासवर्ड अपडेट गर्नुहोस्"
                    : "Update password"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
