import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useUIStore, useAuthStore } from "../store";
import { Button, Card, CardContent, Input } from "../components/ui";
import { Phone, ArrowRight, Shield } from "lucide-react";
import { isSupabaseConfigured } from "../lib";

export default function LoginPage() {
  const { locale, setLocale } = useUIStore();
  const { login, authError } = useAuthStore();
  const navigate = useNavigate();
  const isNepali = locale === "ne";
  const backendConfigured = isSupabaseConfigured();

  const [authMethod, setAuthMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!backendConfigured) {
      setError(
        isNepali
          ? "लगइन सेवा अहिले अस्थायी रूपमा उपलब्ध छैन।"
          : "Login is temporarily unavailable.",
      );
      return;
    }

    if (!email || !password) {
      setError(
        isNepali
          ? "इमेल र पासवर्ड भर्नुहोस्"
          : "Email and password are required",
      );
      return;
    }

    setIsLoading(true);
    const { loginWithEmail } = useAuthStore.getState();
    const isLoggedIn = await loginWithEmail(email, password);
    setIsLoading(false);

    if (!isLoggedIn) {
      setError(
        useAuthStore.getState().authError ??
          (isNepali
            ? "इमेल लगइन असफल भयो। पुन: प्रयास गर्नुहोस्।"
            : "Email login failed. Please try again."),
      );
      return;
    }

    navigate({ to: "/profile" });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!backendConfigured) {
      setError(
        isNepali
          ? "लगइन सेवा अहिले अस्थायी रूपमा उपलब्ध छैन।"
          : "Login is temporarily unavailable.",
      );
      return;
    }

    if (!/^9[678]\d{8}$/.test(phone)) {
      setError(
        isNepali
          ? "मान्य नम्बर प्रविष्ट गर्नुहोस् (९८, ९७, ९६ बाट सुरु हुने)"
          : "Enter valid Nepal number (starting with 98, 97, 96)",
      );
      return;
    }

    setIsLoading(true);
    const otpSent = await login(phone);
    setIsLoading(false);

    if (!otpSent) {
      const rawError = useAuthStore.getState().authError ?? "";
      const isProviderDisabled =
        rawError.toLowerCase().includes("phone_provider_disabled") ||
        rawError.toLowerCase().includes("unsupported phone provider");
      setError(
        isProviderDisabled
          ? (isNepali
              ? "SMS सेवा अहिले उपलब्ध छैन। कृपया इमेल लगइन प्रयोग गर्नुहोस्।"
              : "SMS login is not available right now. Please use email login.")
          : (rawError || (isNepali
              ? "OTP पठाउन सकिएन। पछि पुनः प्रयास गर्नुहोस्।"
              : "Failed to send OTP. Please try again.")),
      );
      return;
    }

    setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!backendConfigured) {
      setError(
        isNepali
          ? "लगइन सेवा अहिले अस्थायी रूपमा उपलब्ध छैन।"
          : "Login is temporarily unavailable.",
      );
      return;
    }

    if (otp.length !== 6) {
      setError(isNepali ? "६ अङ्कको OTP आवश्यक छ" : "6-digit OTP required");
      return;
    }

    setIsLoading(true);
    const isLoggedIn = await login(phone, otp);
    setIsLoading(false);

    if (!isLoggedIn) {
      setError(
        authError ??
          (isNepali
            ? "OTP प्रमाणिकरण असफल भयो। पुन: प्रयास गर्नुहोस्।"
            : "OTP verification failed. Please try again."),
      );
      return;
    }

    navigate({ to: "/profile" });
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
          onClick={() => {
            setAuthMethod("phone");
            setStep("phone");
            setError("");
          }}
          className={`pb-2 px-4 text-sm font-medium transition-colors ${authMethod === "phone" ? "text-crimson-700 border-b-2 border-crimson-700" : "text-terrain-500 hover:text-mountain-900"}`}
        >
          {isNepali ? "मोबाइल नम्बर" : "Mobile Phone"}
        </button>
        <button
          onClick={() => {
            setAuthMethod("email");
            setError("");
          }}
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
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {isNepali ? "इमेल" : "Email"}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  {isNepali ? "पासवर्ड" : "Password"}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !backendConfigured}
              >
                {isLoading ? "..." : isNepali ? "लगइन गर्नुहोस्" : "Sign In"}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>
          ) : step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
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
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="98XXXXXXXX"
                    className="rounded-l-none"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !backendConfigured}
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
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  <Shield className="w-4 h-4 inline mr-1" />
                  OTP
                </label>
                <Input
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !backendConfigured}
              >
                {isLoading ? "..." : isNepali ? "प्रमाणित" : "Verify"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
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
