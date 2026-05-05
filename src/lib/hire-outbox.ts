import {
  hireApi,
  notificationsApi,
  type CreateHireRequest,
} from "@shram-sewa/shared/api";
import { reportWebError } from "./monitoring";
import { queryClient, queryKeys } from "./query-client";
import { getSupabaseClient, isSupabaseConfigured } from "./supabase";

const OUTBOX_KEY = "shram-sewa-hire-outbox-v1";
const MAX_OUTBOX_ITEMS = 40;

let syncSetupDone = false;
let flushInProgress = false;

type StoredHirePayload = Omit<CreateHireRequest, "workDate"> & {
  workDate?: string;
};

interface HireOutboxItem {
  id: string;
  fingerprint: string;
  payload: StoredHirePayload;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
}

interface EnqueueResult {
  queued: boolean;
  duplicate: boolean;
}

interface FlushResult {
  processed: number;
  remaining: number;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function canUseLocalStorage() {
  return isBrowser() && typeof window.localStorage !== "undefined";
}

function generateOutboxId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `hire-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStoredPayload(payload: StoredHirePayload): StoredHirePayload {
  return {
    ...payload,
    workDescription: payload.workDescription?.trim(),
  };
}

function toStoredPayload(payload: CreateHireRequest): StoredHirePayload {
  return normalizeStoredPayload({
    ...payload,
    workDate: payload.workDate ? payload.workDate.toISOString() : undefined,
  });
}

function toRuntimePayload(payload: StoredHirePayload): CreateHireRequest {
  return {
    ...payload,
    workDate: payload.workDate ? new Date(payload.workDate) : undefined,
  };
}

function payloadFingerprint(payload: StoredHirePayload) {
  return JSON.stringify(normalizeStoredPayload(payload));
}

function parseOutbox(raw: string | null): HireOutboxItem[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is HireOutboxItem => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Partial<HireOutboxItem>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.fingerprint === "string" &&
        !!candidate.payload &&
        typeof candidate.enqueuedAt === "string" &&
        typeof candidate.attempts === "number"
      );
    });
  } catch {
    return [];
  }
}

function readOutbox(): HireOutboxItem[] {
  if (!canUseLocalStorage()) {
    return [];
  }

  return parseOutbox(window.localStorage.getItem(OUTBOX_KEY));
}

function writeOutbox(items: HireOutboxItem[]) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("[Outbox] Failed to write to localStorage:", err);
    // If full, try to drop the oldest item and retry once
    if (items.length > 1) {
      try {
        window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(0, -1)));
      } catch (inner) {
        // Give up
      }
    }
  }
}

function updateOutboxItem(
  items: HireOutboxItem[],
  itemId: string,
  patch: Partial<HireOutboxItem>,
): HireOutboxItem[] {
  return items.map((item) =>
    item.id === itemId ? { ...item, ...patch } : item,
  );
}

export function isLikelyNetworkCutoffError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    message?: string;
    name?: string;
    status?: number;
    code?: string;
  };

  if (candidate.status === 0 || candidate.code === "ECONNRESET") {
    return true;
  }

  const message = (candidate.message ?? "").toLowerCase();
  const name = (candidate.name ?? "").toLowerCase();

  return (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("timeout") ||
    message.includes("offline") ||
    name.includes("network")
  );
}

export function enqueueHireOutbox(payload: CreateHireRequest): EnqueueResult {
  if (!canUseLocalStorage()) {
    return { queued: false, duplicate: false };
  }

  const storedPayload = toStoredPayload(payload);
  const fingerprint = payloadFingerprint(storedPayload);
  const outbox = readOutbox();

  if (outbox.some((item) => item.fingerprint === fingerprint)) {
    return { queued: true, duplicate: true };
  }

  const next = [
    {
      id: generateOutboxId(),
      fingerprint,
      payload: storedPayload,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    },
    ...outbox,
  ].slice(0, MAX_OUTBOX_ITEMS);

  writeOutbox(next);
  return { queued: true, duplicate: false };
}

export function getQueuedHireCount() {
  return readOutbox().length;
}

async function submitQueuedHire(payload: CreateHireRequest) {
  const hire = await hireApi.create(payload);

  queryClient.invalidateQueries({ queryKey: queryKeys.hires.all });
  queryClient.invalidateQueries({
    queryKey: queryKeys.hires.byWorker(hire.workerId),
  });
  queryClient.invalidateQueries({
    queryKey: queryKeys.hires.byHirer(hire.hirerId),
  });

  void notificationsApi.dispatchHireRequest(hire.id).catch((error) => {
    void reportWebError({
      category: "notification",
      level: "warning",
      message:
        error instanceof Error
          ? error.message
          : "Queued hire notification dispatch failed",
      context: {
        hireId: hire.id,
        workerId: hire.workerId,
        hirerId: hire.hirerId,
        source: "outbox-sync",
      },
    });
  });
}

export async function flushHireOutbox(): Promise<FlushResult> {
  if (flushInProgress) {
    return { processed: 0, remaining: getQueuedHireCount() };
  }

  if (!isBrowser() || !isSupabaseConfigured()) {
    return { processed: 0, remaining: getQueuedHireCount() };
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processed: 0, remaining: getQueuedHireCount() };
  }

  try {
    getSupabaseClient();
  } catch {
    return { processed: 0, remaining: getQueuedHireCount() };
  }

  flushInProgress = true;

  try {
    let processed = 0;
    let outbox = readOutbox();

    for (const item of outbox) {
      try {
        await submitQueuedHire(toRuntimePayload(item.payload));
        outbox = outbox.filter((candidate) => candidate.id !== item.id);
        writeOutbox(outbox);
        processed += 1;
      } catch (error) {
        const attempts = item.attempts + 1;

        if (isLikelyNetworkCutoffError(error)) {
          outbox = updateOutboxItem(outbox, item.id, {
            attempts,
            lastError:
              error instanceof Error ? error.message : "Network cutoff",
          });
          writeOutbox(outbox);
          break;
        }

        // Drop permanently invalid payloads after a few failed attempts.
        if (attempts >= 3) {
          outbox = outbox.filter((candidate) => candidate.id !== item.id);
          writeOutbox(outbox);
        } else {
          outbox = updateOutboxItem(outbox, item.id, {
            attempts,
            lastError:
              error instanceof Error ? error.message : "Unknown outbox error",
          });
          writeOutbox(outbox);
        }

        void reportWebError({
          category: "mutation",
          level: "warning",
          message:
            error instanceof Error
              ? error.message
              : "Queued hire failed to sync",
          context: {
            outboxItemId: item.id,
            attempts,
            workerId: item.payload.workerId,
          },
        });
      }
    }

    return { processed, remaining: outbox.length };
  } finally {
    flushInProgress = false;
  }
}

export function setupHireOutboxSync() {
  if (syncSetupDone || !isBrowser()) {
    return;
  }

  const triggerSync = () => {
    void flushHireOutbox();
  };

  window.addEventListener("online", triggerSync);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerSync();
    }
  });

  syncSetupDone = true;
  triggerSync();
}
