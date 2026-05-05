/**
 * Hire Modal Component
 * Modal for confirming worker hire with work details
 * Uses hire state machine for status tracking
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, FileText, DollarSign, Clock } from "lucide-react";
import { Button, Card, CardContent, Badge } from "./ui";
import { useAuthStore, useUIStore } from "../store";
import {
  createIpFingerprint,
  hasHireIpLock,
  isSupabaseConfigured,
  resolveClientIpAddress,
  setHireIpLock,
} from "../lib";
import {
  enqueueHireOutbox,
  isLikelyNetworkCutoffError,
} from "../lib/hire-outbox";
import { useCreateHireMutation } from "../hooks";
import { useToast } from "../components/ToastContainer";
import NepaliDate from "nepali-date";

interface HireModalProps {
  isOpen: boolean;
  onClose: () => void;
  worker: {
    id: string;
    name: string;
    jobCategory: string;
    dailyRate?: number;
    avatar?: string;
  };
}

export function HireModal({ isOpen, onClose, worker }: HireModalProps) {
  const { locale } = useUIStore();
  const { user: currentUser } = useAuthStore();
  const createHireMutation = useCreateHireMutation();
  const toast = useToast();
  const isNepali = locale === "ne";
  
  const isSelfHire = currentUser?.id === worker.id;

  const defaultRate = worker.dailyRate ?? 0;
  const today = new Date().toISOString().split("T")[0] ?? "";
  const [workDescription, setWorkDescription] = useState("");
  const [agreedRate, setAgreedRate] = useState(defaultRate);
  const [workDate, setWorkDate] = useState<string>(today);
  const [workDays, setWorkDays] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const handleConfirm = async () => {
    setError(null);
    setErrorStatus(null);

    if (isSelfHire) {
      setError(
        isNepali ? "तपाईंले आफैलाई भाडामा लिन सक्नुहुन्न।" : "You cannot hire yourself.",
      );
      setErrorStatus(403);
      return;
    }

    if (!workDescription.trim()) {
      setError(
        isNepali ? "कामको विवरण आवश्यक छ।" : "Work description is required.",
      );
      setErrorStatus(400);
      return;
    }

    if (!isSupabaseConfigured()) {
      setError(
        isNepali ? "भाडा सेवा उपलब्ध छैन।" : "Hiring service is unavailable.",
      );
      setErrorStatus(503);
      return;
    }

    const hirerIp = await resolveClientIpAddress();

    if (hirerIp && hasHireIpLock(worker.id, hirerIp)) {
      setError(
        isNepali
          ? "यो IP बाट यो कामदारलाई अनुरोध पहिले नै पठाइएको छ।"
          : "A request for this worker already exists from this IP.",
      );
      setErrorStatus(409);
      return;
    }

    try {
      const ipFingerprint = createIpFingerprint();
      const payload = {
        workerId: worker.id,
        hirerIp: hirerIp ?? undefined,
        ipFingerprint,
        workDescription: workDescription.trim(),
        agreedRateNpr: agreedRate > 0 ? agreedRate : undefined,
        workDate: new Date(workDate),
        workDurationDays: workDays,
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueHireOutbox(payload);
        toast.info(
          isNepali ? "अनुरोध सुरक्षित गरियो" : "Request saved",
          isNepali
            ? "इन्टरनेट फर्केपछि भाडा अनुरोध आफैं पठाइन्छ।"
            : "This hire request will auto-send when internet returns.",
        );
        onClose();
        return;
      }

      await createHireMutation.mutateAsync(payload);

      if (hirerIp) {
        setHireIpLock(worker.id, hirerIp, ipFingerprint);
      }
      onClose();
    } catch (mutationError) {
      if (isLikelyNetworkCutoffError(mutationError)) {
        toast.info(
          isNepali ? "अनुरोध सुरक्षित गरियो" : "Request saved",
          isNepali
            ? "नेटवर्क कट हुँदा अनुरोध सुरक्षित गरिएको छ। इन्टरनेट फर्केपछि पठाइन्छ।"
            : "Network dropped. Your request has been queued and will sync automatically.",
        );
        onClose();
        return;
      }

      setError(
        mutationError instanceof Error
          ? mutationError.message
          : isNepali
            ? "भाडा अनुरोध पठाउन सकिएन।"
            : "Unable to send hire request.",
      );
      setErrorStatus(500);
    }
  };

  const totalCost = agreedRate * workDays;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.98, opacity: 0, y: 8 }}
              transition={{
                type: "spring",
                damping: 28,
                stiffness: 380,
                mass: 0.8,
              }}
              className="w-full max-w-md max-h-[90vh]"
              onClick={(event) => event.stopPropagation()}
            >
              <Card className="max-h-[90vh] overflow-hidden">
                <CardContent className="p-6 max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-mountain-900">
                      {isNepali ? "भाडा निश्चित गर्नुहोस्" : "Confirm Hire"}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                      <X className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Worker Info */}
                  <div className="flex items-center gap-3 mb-6 p-3 bg-terrain-50 rounded-lg">
                    {worker.avatar ? (
                      <img
                        src={worker.avatar}
                        alt={worker.name}
                        className="w-12 h-12 rounded-full object-cover border border-terrain-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-crimson-500 to-gold-500 flex items-center justify-center text-white font-bold">
                        {worker.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-mountain-900">
                        {worker.name}
                      </h3>
                      <p className="text-sm text-terrain-500">
                        {worker.jobCategory}
                      </p>
                    </div>
                    <Badge variant="gold">
                      रू {worker.dailyRate?.toLocaleString("en-IN")}
                    </Badge>
                  </div>

                  {/* Form */}
                  <div className="space-y-4 mb-6">
                    {/* Work Description */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-mountain-900 mb-2">
                        <FileText className="w-4 h-4" />
                        {isNepali ? "काम विवरण" : "Work Description"}
                      </label>
                      <textarea
                        value={workDescription}
                        onChange={(e) => setWorkDescription(e.target.value)}
                        placeholder={
                          isNepali
                            ? "के काम गर्नुपर्छ वर्णन गर्नुहोस्..."
                            : "Describe the work to be done..."
                        }
                        className="w-full px-3 py-2 border border-terrain-300 rounded-lg bg-white text-mountain-900 placeholder:text-terrain-500 focus:ring-2 focus:ring-crimson-500 focus:border-transparent resize-none"
                        rows={3}
                      />
                    </div>

                    {/* Work Date */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-medium text-mountain-900 mb-2">
                        <Calendar className="w-4 h-4" />
                        {isNepali ? "काम मिति" : "Work Date"}
                        {workDate && (
                          <span className="text-xs text-terrain-500 font-normal ml-auto">
                            (वि.सं.{" "}
                            {new NepaliDate(new Date(workDate)).format(
                              "YYYY-MM-DD",
                            )}
                            )
                          </span>
                        )}
                      </label>
                      <input
                        type="date"
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                        min={today}
                        className="w-full px-3 py-2 border border-terrain-300 rounded-lg bg-white text-mountain-900 focus:ring-2 focus:ring-crimson-500 focus:border-transparent"
                      />
                    </div>

                    {/* Duration & Rate */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-mountain-900 mb-2">
                          <Clock className="w-4 h-4" />
                          {isNepali ? "अवधि (दिन)" : "Duration (days)"}
                        </label>
                        <input
                          type="number"
                          value={workDays}
                          onChange={(e) =>
                            setWorkDays(
                              Math.max(1, parseInt(e.target.value) || 1),
                            )
                          }
                          min={1}
                          className="w-full px-3 py-2 border border-terrain-300 rounded-lg bg-white text-mountain-900 focus:ring-2 focus:ring-crimson-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-medium text-mountain-900 mb-2">
                          <DollarSign className="w-4 h-4" />
                          {isNepali ? "दैनिक दर" : "Daily Rate"}
                        </label>
                        <input
                          type="number"
                          value={agreedRate}
                          onChange={(e) =>
                            setAgreedRate(
                              Math.max(0, parseInt(e.target.value) || 0),
                            )
                          }
                          min={0}
                          className="w-full px-3 py-2 border border-terrain-300 rounded-lg bg-white text-mountain-900 focus:ring-2 focus:ring-crimson-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total Cost */}
                  <div className="bg-crimson-50 border border-crimson-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-crimson-700 font-medium">
                        {isNepali ? "कुल लागत" : "Total Cost"}
                      </span>
                      <span className="text-2xl font-bold text-crimson-700">
                        रू {totalCost.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <p className="text-xs text-crimson-600 mt-1">
                      {isNepali
                        ? `${workDays} दिन × रू ${agreedRate.toLocaleString("en-IN")}`
                        : `${workDays} day${workDays > 1 ? "s" : ""} × रू ${agreedRate.toLocaleString("en-IN")}`}
                    </p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                      {errorStatus && (
                        <p className="text-xs font-semibold text-red-800 mb-1">
                          {isNepali
                            ? `त्रुटि स्थिति: ${errorStatus}`
                            : `Error status: ${errorStatus}`}
                        </p>
                      )}
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="flex-1"
                      disabled={createHireMutation.isPending}
                    >
                      {isNepali ? "रद्द गर्नुहोस्" : "Cancel"}
                    </Button>
                    <motion.div className="flex-1" whileTap={{ scale: 0.97 }}>
                      <Button
                        onClick={handleConfirm}
                        className="w-full"
                        disabled={createHireMutation.isPending || isSelfHire}
                      >
                        {createHireMutation.isPending
                          ? isNepali
                            ? "पठाउँदै..."
                            : "Sending..."
                          : isNepali
                            ? "निश्चित गर्नुहोस्"
                            : "Confirm Hire"}
                      </Button>
                    </motion.div>
                  </div>

                  {/* Info note */}
                  <p className="text-xs text-terrain-500 text-center mt-4">
                    {isNepali
                      ? "IP प्रमाणीकरण स्थानीय रूपमा असफल भए पनि सर्भरले अनुरोध समयमा IP रेकर्ड गर्ने प्रयास गर्छ"
                      : "If local IP lookup fails, the server will still attempt to resolve and record your IP"}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
