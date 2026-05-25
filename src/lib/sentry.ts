// Env-conditional Sentry integration.
//
// Loaded only when VITE_SENTRY_DSN is configured. We use a dynamic import
// so users without Sentry pay ZERO bytes for the SDK — the @sentry/browser
// chunk only enters the network when init runs and succeeds.
//
// Sits ALONGSIDE the existing report-error edge function pipeline, not
// instead of it. Both sinks receive every error so we don't lose data if
// Sentry's quota is hit or the project is paused.

type SentryModule = typeof import("@sentry/browser");
let sentryClient: SentryModule | null = null;
let initPromise: Promise<SentryModule | null> | null = null;

function readDsn(): string | null {
  const dsn =
    (import.meta as unknown as { env: Record<string, string | undefined> })
      .env?.VITE_SENTRY_DSN ?? null;
  return typeof dsn === "string" && dsn.trim().length > 0 ? dsn.trim() : null;
}

export function initSentry(): Promise<SentryModule | null> {
  if (initPromise) return initPromise;

  const dsn = readDsn();
  if (!dsn) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }

  initPromise = import("@sentry/browser")
    .then((mod) => {
      mod.init({
        dsn,
        // Mode is "production" on Vercel, "development" locally.
        environment:
          (import.meta as unknown as { env: { MODE?: string } }).env?.MODE ??
          "production",
        // Default to zero overhead — performance + replay only when the
        // user explicitly opts in via Sentry project settings.
        tracesSampleRate: 0,
        // Catch unhandled exceptions and promise rejections out of the box.
        defaultIntegrations: undefined,
        // Strip query strings from URLs so PII (?token=, ?email=) isn't
        // leaked into the error fingerprint.
        beforeSend(event) {
          if (event.request?.url) {
            try {
              const u = new URL(event.request.url);
              u.search = "";
              event.request.url = u.toString();
            } catch {
              // leave URL as-is if not parseable
            }
          }
          return event;
        },
      });
      sentryClient = mod;
      return mod;
    })
    .catch((error) => {
      // Loading Sentry SHOULD NOT crash the app. Swallow and continue —
      // we still have the report-error edge function pipeline as fallback.
      console.warn("[sentry] init failed", error);
      return null;
    });

  return initPromise;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentryClient) return;
  try {
    sentryClient.captureException(error, context ? { extra: context } : undefined);
  } catch (e) {
    console.warn("[sentry] captureException failed", e);
  }
}

export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "error",
  context?: Record<string, unknown>,
): void {
  if (!sentryClient) return;
  try {
    sentryClient.captureMessage(message, {
      level,
      ...(context ? { extra: context } : {}),
    });
  } catch (e) {
    console.warn("[sentry] captureMessage failed", e);
  }
}

export function setUserContext(
  user: { id?: string; phone?: string } | null,
): void {
  if (!sentryClient) return;
  try {
    if (user?.id) {
      // Phone is PII — store only id by default; project owners can
      // enable phone capture in Sentry settings if needed.
      sentryClient.setUser({ id: user.id });
    } else {
      sentryClient.setUser(null);
    }
  } catch (e) {
    console.warn("[sentry] setUser failed", e);
  }
}
