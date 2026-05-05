/**
 * Header Component
 * Main navigation header with language toggle and auth
 */

import { Link } from "@tanstack/react-router";
import { Button } from "./ui";
import { Menu, Globe, LogIn, User } from "lucide-react";
import { useUIStore } from "../store";
import { useAuthStore } from "../store/auth-store";
import { motion } from "framer-motion";

export function Header() {
  const { locale, toggleLocale, toggleSidebar } = useUIStore();
  const { isAuthenticated, user } = useAuthStore();
  const isNepali = locale === "ne";

  return (
    <header className="sticky top-0 z-30 border-b border-terrain-200/80 bg-white/85 backdrop-blur-md">
      <div className="h-px w-full bg-gradient-to-r from-transparent via-crimson-300 to-transparent" />
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-[4.5rem]">
          {/* Logo */}
          <Link
            to="/"
            preload="intent"
            className="flex items-center gap-3 group"
          >
            <motion.div
              whileHover={{ y: -1, scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <img src="/logo.png" alt="Shram Sewa" className="h-10 w-auto" />
            </motion.div>
            <div>
              <h1 className="text-xl font-display font-bold text-mountain-900 group-hover:text-crimson-700 transition-colors">
                {isNepali ? "श्रम सेवा" : "Shram Sewa"}
              </h1>
              <p className="text-xs text-terrain-500 -mt-0.5">
                {isNepali ? "नेपाल जनशक्ति" : "Nepal Manpower"}
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2 rounded-full border border-terrain-200 bg-white/90 px-3 py-1 shadow-sm">
            <Link
              to="/search"
              preload="intent"
              className="rounded-full px-3 py-2 text-sm font-medium text-mountain-900 hover:bg-terrain-100 hover:text-crimson-700 transition-colors"
            >
              {isNepali ? "कामदार खोज्नुहोस्" : "Find Workers"}
            </Link>
            <Link
              to="/login"
              preload="intent"
              className="rounded-full px-3 py-2 text-sm font-medium text-mountain-900 hover:bg-terrain-100 hover:text-crimson-700 transition-colors"
            >
              {isNepali ? "कामदार दर्ता" : "Register as Worker"}
            </Link>

            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLocale}
              className="gap-2 rounded-full"
            >
              <Globe className="w-4 h-4" />
              <span>{isNepali ? "EN" : "नेपाली"}</span>
            </Button>

            {/* Auth */}
            {isAuthenticated ? (
              <Link to="/profile" preload="intent">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                >
                  <User className="w-4 h-4" />
                  {user?.fullName?.split(" ")[0] ?? "Profile"}
                </Button>
              </Link>
            ) : (
              <Link to="/login" preload="intent">
                <Button size="sm" className="gap-2 rounded-full">
                  <LogIn className="w-4 h-4" />
                  {isNepali ? "लगइन" : "Login"}
                </Button>
              </Link>
            )}
          </nav>

          {/* Mobile Language Toggle Instead of Menu */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden gap-2 rounded-full"
            onClick={toggleLocale}
          >
            <Globe className="w-4 h-4" />
            <span>{isNepali ? "EN" : "नेपाली"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
