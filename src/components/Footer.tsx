/**
 * Footer Component
 * Site footer with links and copyright
 */

import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useUIStore } from "../store";
import { MapPin, Phone, Mail, Globe, Loader2 } from "lucide-react";

const PLAY_STORE_URL =
  (import.meta as any).env?.PUBLIC_ANDROID_PLAY_STORE_URL ||
  (import.meta as any).env?.VITE_PLAY_STORE_URL ||
  (import.meta as any).env?.VITE_ANDROID_PLAY_STORE_URL ||
  "#";
const GOOGLE_DRIVE_URL =
  (import.meta as any).env?.PUBLIC_ANDROID_APK_DRIVE_URL ||
  (import.meta as any).env?.PUBLIC_ANDROID_APK_URL ||
  (import.meta as any).env?.VITE_ANDROID_APK_DRIVE_URL ||
  (import.meta as any).env?.VITE_GOOGLE_DRIVE_URL ||
  "#";
const PLAY_STORE_BADGE_SRC = "/google-play-badge-official.png";
const SUPPORT_EMAIL =
  (import.meta as any).env?.PUBLIC_SUPPORT_EMAIL ||
  (import.meta as any).env?.VITE_SUPPORT_EMAIL ||
  "support@shramsewa.jeevanbhatt.com.np";

export function Footer() {
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const appDownloadUrl =
    GOOGLE_DRIVE_URL !== "#" ? GOOGLE_DRIVE_URL : PLAY_STORE_URL;

  const [downloadState, setDownloadState] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const handleDownloadClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    e.preventDefault();
    if (downloadState === "loading") return;

    setDownloadState("loading");

    try {
      // Show loading UI momentarily
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Attempt to ping the URL to check connectivity (mode: 'no-cors' allows opaque responses without CORS issues)
      await fetch(appDownloadUrl, { mode: "no-cors" });

      // Create physical anchor to trigger download robustly
      const link = document.createElement("a");
      link.href = appDownloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revert button shortly after triggering
      setTimeout(() => setDownloadState("idle"), 2000);
    } catch (err) {
      console.error("Download failed:", err);
      setDownloadState("error");
    }
  };

  return (
    <footer className="text-white bg-[radial-gradient(circle_at_15%_20%,#1f3e66_0%,#112641_45%,#0a1520_100%)] border-t border-mountain-700/60">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mb-8">
          <h3 className="font-bold text-lg mb-3">
            {isNepali ? "श्रम सेवा" : "Shram Sewa"}
          </h3>
          <p className="text-sm text-terrain-100/90 leading-relaxed mb-4">
            {isNepali
              ? "नेपालको स्थानीय तह केन्द्रित जनशक्ति प्लेटफर्म। ७५३ स्थानीय तहसम्म पहुँच, सुरक्षित खोज र जिम्मेवार भाडा प्रक्रियासहित।"
              : "Nepal's local-level manpower platform with coverage across all 753 local units, safer discovery, and accountable hiring workflows."}
          </p>
          <div className="flex gap-3">
            <a
              href="/contact"
              className="w-8 h-8 rounded-full bg-crimson-700 flex items-center justify-center hover:bg-crimson-600 transition-colors"
              aria-label={isNepali ? "वेबसाइट" : "Website"}
            >
              <Globe className="w-4 h-4" />
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="w-8 h-8 rounded-full bg-crimson-700 flex items-center justify-center hover:bg-crimson-600 transition-colors"
              aria-label={isNepali ? "इमेल" : "Email"}
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Mobile starts at 2 columns so each column has room for long
            strings like the email; 3 columns at sm; 4 at md. Previously
            3-col on mobile crammed columns to ~108px which is narrower
            than the support email — the link overflowed and pushed
            the page's scrollWidth past the viewport, creating the
            phantom right-side gap the user was seeing. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-8 md:grid-cols-4">
          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-base md:text-lg mb-4">
              {isNepali ? "द्रुत लिंकहरू" : "Quick Links"}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/search"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "कामदार खोज्नुहोस्" : "Find Workers"}
                </Link>
              </li>
              <li>
                <Link
                  to="/most-hired"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "शीर्ष भाडा" : "Top Hires"}
                </Link>
              </li>
              <li>
                <Link
                  to="/login"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "कामदार दर्ता" : "Register as Worker"}
                </Link>
              </li>
              <li>
                <Link
                  to="/how-it-works"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "कसरी काम गर्छ?" : "How It Works"}
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "सामान्य प्रश्नहरू" : "FAQ"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-bold text-base md:text-lg mb-4">
              {isNepali ? "कानुनी" : "Legal"}
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/privacy"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "गोपनीयता नीति" : "Privacy Policy"}
                </Link>
              </li>
              <li>
                <Link
                  to="/terms"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "सेवा सर्तहरू" : "Terms of Service"}
                </Link>
              </li>
              <li>
                <Link
                  to="/guidelines"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "मार्गदर्शन" : "Guidelines"}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-base md:text-lg mb-4">
              {isNepali ? "सम्पर्क" : "Contact"}
            </h3>
            <ul className="space-y-3 text-sm text-terrain-100">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{isNepali ? "काठमाडौं, नेपाल" : "Kathmandu, Nepal"}</span>
              </li>
              {/* Phone is only rendered when PUBLIC_SUPPORT_PHONE is set.
                  Previously the footer showed the placeholder string
                  "+977 1-XXXXXXX" to every visitor — a real-user-visible
                  stub. Hiding it is strictly better than showing fake. */}
              {import.meta.env.PUBLIC_SUPPORT_PHONE && (
                <li className="flex items-center gap-2 min-w-0">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <a
                    href={`tel:${import.meta.env.PUBLIC_SUPPORT_PHONE}`}
                    className="truncate"
                  >
                    {import.meta.env.PUBLIC_SUPPORT_PHONE}
                  </a>
                </li>
              )}
              {/* min-w-0 on the flex li + break-all on the link lets the
                  long unbreakable email wrap inside the column instead
                  of forcing the entire footer grid to expand past the
                  viewport. flex-shrink-0 on the icon keeps it square. */}
              <li className="flex items-start gap-2 min-w-0">
                <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="break-all"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-terrain-100 hover:text-gold-300 transition-colors"
                >
                  {isNepali ? "विस्तृत सम्पर्क" : "Full Contact Page"}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-3 md:col-span-1">
            <h3 className="font-bold text-base md:text-lg mb-4">
              {isNepali ? "डाउनलोड" : "Download"}
            </h3>
            <p className="text-sm text-terrain-200 mb-3">
              {isNepali
                ? "एन्ड्रोइड एप डाउनलोड गर्नुहोस्"
                : "Get the Android app"}
            </p>

            {downloadState === "idle" ? (
              <a
                href={appDownloadUrl}
                target="_blank"
                rel="noreferrer"
                onClick={handleDownloadClick}
                aria-label={
                  isNepali ? "एन्ड्रोइड एप डाउनलोड" : "Download Android app"
                }
                className="inline-flex transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:-translate-y-0.5 relative"
              >
                <img
                  src={PLAY_STORE_BADGE_SRC}
                  alt={
                    isNepali
                      ? "Google Play बाट डाउनलोड"
                      : "Get it on Google Play"
                  }
                  className="h-[5rem] sm:h-[5.15rem] md:h-[5rem] w-auto max-w-[20.5rem] md:max-w-[20rem]"
                />
              </a>
            ) : (
              <div className="h-[5rem] sm:h-[5.15rem] md:h-[5rem] w-[13.5rem] sm:w-[14rem] bg-mountain-800/50 rounded-xl border border-mountain-700 flex flex-col items-center justify-center p-3 animate-in fade-in zoom-in-95 duration-200">
                {downloadState === "loading" ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin text-gold-300 mb-2" />
                    <span className="text-[13px] font-medium text-terrain-100 whitespace-nowrap">
                      {isNepali
                        ? "डाउनलोड तयार गर्दै..."
                        : "Preparing download..."}
                    </span>
                  </>
                ) : (
                  <div className="text-center">
                    <p className="text-xs text-crimson-400 mb-2 flex items-center justify-center gap-1 font-medium">
                      {isNepali ? "डाउनलोड असफल भयो।" : "Download failed."}
                    </p>
                    <a
                      href={GOOGLE_DRIVE_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-gold-300 hover:text-gold-100 hover:underline transition-colors"
                      onClick={() => setDownloadState("idle")}
                    >
                      {isNepali
                        ? "ड्राइभ लिङ्क प्रयोग गर्नुहोस्"
                        : "Try Drive link ->"}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-mountain-700 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-terrain-300">
            {isNepali
              ? "© २०२६ श्रम सेवा। सर्वाधिकार सुरक्षित।"
              : "© 2026 Shram Sewa. All rights reserved."}
          </p>
          <p className="text-sm text-terrain-300">
            {isNepali
              ? "स्थानीय तह केन्द्रित डिजिटल सेवा"
              : "Local-level focused digital service"}
          </p>
        </div>
      </div>
    </footer>
  );
}
