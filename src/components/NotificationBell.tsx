import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "../hooks";
import { useAuthStore, useUIStore } from "../store";

// The realtime subscription is mounted once at the app root, so this component
// only handles display state.
export function NotificationBell() {
  const { isAuthenticated } = useAuthStore();
  const { locale } = useUIStore();
  const isNepali = locale === "ne";

  const { data } = useNotifications(isAuthenticated);

  if (!isAuthenticated) {
    return null;
  }

  const unread = data?.filter((n) => !n.isRead).length ?? 0;
  const ariaLabel = isNepali
    ? unread > 0
      ? `${unread} नयाँ सूचना`
      : "सूचनाहरू"
    : unread > 0
      ? `${unread} unread notification${unread === 1 ? "" : "s"}`
      : "Notifications";

  return (
    <Link
      to="/profile"
      preload="intent"
      aria-label={ariaLabel}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-mountain-700 hover:bg-terrain-100 hover:text-crimson-700 transition-colors"
    >
      <Bell className="h-5 w-5" />
      <AnimatePresence>
        {unread > 0 && (
          <motion.span
            key={unread}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-crimson-700 text-white text-[10px] font-semibold leading-[18px] text-center shadow-sm"
          >
            {unread > 99 ? "99+" : unread}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
}
