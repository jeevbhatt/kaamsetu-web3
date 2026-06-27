/**
 * ProfileMenu
 * Hover- (and focus-) activated profile dropdown for the desktop header.
 * Built with plain Tailwind (group-hover / focus-within) so it needs no
 * extra Radix dependency, while keeping a shadcn-like surface + items.
 */

import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../store/auth-store";
import { useUIStore } from "../store";
import { Button } from "./ui";
import {
  User,
  LayoutDashboard,
  Settings,
  Shield,
  LogOut,
  ChevronDown,
} from "lucide-react";

export function ProfileMenu() {
  const { user, logout } = useAuthStore();
  const { locale } = useUIStore();
  const isNepali = locale === "ne";
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  const firstName = (() => {
    const full = isNepali
      ? user?.fullNameNp || user?.fullName
      : user?.fullName || user?.fullNameNp;
    return full?.split(" ")[0] ?? (isNepali ? "प्रोफाइल" : "Profile");
  })();

  const itemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-mountain-900 hover:bg-terrain-100 hover:text-crimson-700 transition-colors";

  return (
    <div className="relative group">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full"
        // Keep it keyboard-reachable; the panel also opens on focus-within.
      >
        <User className="w-4 h-4" />
        {firstName}
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </Button>

      {/* Panel — visible on hover or when any child has focus. The pt-2
          bridge keeps the hover intact while the cursor travels down. */}
      <div className="invisible absolute right-0 top-full z-40 w-56 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="rounded-xl border border-terrain-200 bg-white p-1.5 shadow-lg">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold text-mountain-900 truncate">
              {firstName}
            </div>
            <div className="text-xs text-terrain-500 truncate">
              {user?.phone || ""}
            </div>
          </div>
          <div className="my-1 h-px bg-terrain-200" />

          <Link to="/profile" className={itemClass}>
            <LayoutDashboard className="w-4 h-4" />
            {isNepali ? "ड्यासबोर्ड" : "Dashboard"}
          </Link>
          <Link to="/profile" hash="settings" className={itemClass}>
            <Settings className="w-4 h-4" />
            {isNepali ? "सेटिङ" : "Settings"}
          </Link>
          {isAdmin && (
            <Link to="/admin" className={itemClass}>
              <Shield className="w-4 h-4" />
              {isNepali ? "एडमिन कन्सोल" : "Admin console"}
            </Link>
          )}

          <div className="my-1 h-px bg-terrain-200" />
          <button
            type="button"
            onClick={() => {
              void logout();
              void navigate({ to: "/" });
            }}
            className={`${itemClass} text-red-600 hover:text-red-700`}
          >
            <LogOut className="w-4 h-4" />
            {isNepali ? "लगआउट" : "Logout"}
          </button>
        </div>
      </div>
    </div>
  );
}
