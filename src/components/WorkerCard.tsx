/**
 * Worker Card Component
 * Displays worker information with hire action
 * Supports both list and grid layouts
 */

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  Badge,
  Button,
} from "./ui";
import { MapPin, Star, Phone, CheckCircle, Clock } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useUIStore } from "../store";
import { usePrefetchWorker } from "../hooks";
import { motion, useReducedMotion } from "framer-motion";
import type { WorkerDisplay } from "@shram-sewa/shared";

interface WorkerCardProps {
  worker: WorkerDisplay;
  variant?: "grid" | "list";
  onHire?: (workerId: string) => void;
  showHireButton?: boolean;
}

export function WorkerCard({
  worker,
  variant = "grid",
  onHire,
  showHireButton = true,
}: WorkerCardProps) {
  const { locale } = useUIStore();
  const prefetchWorker = usePrefetchWorker();
  const reduceMotion = useReducedMotion();
  const isNepali = locale === "ne";
  const displayName = isNepali
    ? (worker.user.fullNameNp ?? worker.user.fullName ?? "कामदार")
    : (worker.user.fullName ?? worker.user.fullNameNp ?? "Worker");
  const displayLocation = isNepali
    ? `${worker.localUnit.nameNp ?? worker.localUnit.nameEn}, ${worker.district.nameNp ?? worker.district.nameEn}`
    : `${worker.localUnit.nameEn ?? worker.localUnit.nameNp}, ${worker.district.nameEn ?? worker.district.nameNp}`;

  const handleHireClick = () => {
    if (onHire) {
      onHire(worker.id);
    }
  };

  const handlePrefetch = () => {
    prefetchWorker(worker.id);
  };

  return (
    <motion.div
      onHoverStart={handlePrefetch}
      whileHover={reduceMotion ? undefined : { y: -2, scale: 1.005 }}
      whileTap={reduceMotion ? undefined : { scale: 0.992 }}
      transition={
        reduceMotion
          ? undefined
          : { type: "spring", stiffness: 420, damping: 30, mass: 0.75 }
      }
    >
      <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-crimson-200">
        <CardContent
          className={`p-4 ${variant === "list" ? "flex gap-4" : ""}`}
        >
          {/* Avatar */}
          <div className={`${variant === "list" ? "flex-shrink-0" : "mb-3"}`}>
            <div className="relative">
              <Avatar className="h-16 w-16 border border-terrain-200">
                {worker.user.avatarUrl ? (
                  <AvatarImage src={worker.user.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-crimson-500 to-gold-500 text-xl font-bold text-white">
                  {displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {worker.isAvailable && (
                <div className="absolute -bottom-1 -right-1">
                  <div className="w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                </div>
              )}
            </div>
          </div>

          {/* Worker Info */}
          <div className="flex-1 min-w-0">
            {/* Name & Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <Link
                  to="/worker/$workerId"
                  params={{ workerId: worker.id }}
                  preload="intent"
                  onFocus={handlePrefetch}
                  onMouseEnter={handlePrefetch}
                  className="inline-flex max-w-full"
                >
                  <h3 className="font-semibold text-mountain-900 truncate hover:text-crimson-700 transition-colors">
                    {displayName}
                  </h3>
                </Link>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-terrain-500">
                    {isNepali
                      ? worker.jobCategory.nameNp
                      : worker.jobCategory.nameEn}
                  </p>
                  {worker.isApproved && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-medium text-green-700"
                      title={
                        isNepali
                          ? "श्रम सेवाद्वारा प्रमाणित"
                          : "Verified by Shram Sewa"
                      }
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {isNepali ? "प्रमाणित" : "Verified"}
                    </span>
                  )}
                </div>
              </div>
              {worker.isAvailable && (
                <Badge variant="success" className="flex-shrink-0">
                  {isNepali ? "उपलब्ध" : "Available"}
                </Badge>
              )}
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 text-sm text-terrain-500 mb-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{displayLocation}</span>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-3">
              {/* Rating */}
              {worker.avgRating > 0 && (
                <div className="flex items-center gap-1 text-sm">
                  <Star className="w-4 h-4 fill-gold-500 text-gold-500" />
                  <span className="font-medium text-mountain-900">
                    {worker.avgRating.toFixed(1)}
                  </span>
                  <span className="text-terrain-500">
                    ({worker.totalReviews})
                  </span>
                </div>
              )}

              {/* Experience */}
              {worker.experienceYrs > 0 && (
                <div className="flex items-center gap-1 text-sm text-terrain-500">
                  <Clock className="w-4 h-4" />
                  <span>
                    {worker.experienceYrs}{" "}
                    {isNepali
                      ? "वर्ष"
                      : worker.experienceYrs === 1
                        ? "year"
                        : "years"}
                  </span>
                </div>
              )}

              {/* Total Hires */}
              {worker.totalHires > 0 && (
                <div className="flex items-center gap-1 text-sm text-terrain-500">
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {worker.totalHires} {isNepali ? "भाडा" : "hires"}
                  </span>
                </div>
              )}
            </div>

            {/* Daily Rate */}
            {worker.dailyRateNpr && (
              <div className="mb-3">
                <span className="text-xs text-terrain-500 uppercase">
                  {isNepali ? "दैनिक दर" : "Daily Rate"}
                </span>
                <div className="text-lg font-bold text-crimson-700">
                  रू {worker.dailyRateNpr.toLocaleString("en-IN")}
                </div>
              </div>
            )}

            {/* About (truncated) */}
            {worker.about && (
              <p className="text-sm text-terrain-500 line-clamp-2 mb-3">
                {worker.about}
              </p>
            )}

            {/* Actions */}
            {showHireButton && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <Button
                    onClick={handleHireClick}
                    disabled={!worker.isAvailable}
                    className="w-full"
                    size="sm"
                  >
                    {isNepali ? "भाडामा लिनुहोस्" : "Hire"}
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
