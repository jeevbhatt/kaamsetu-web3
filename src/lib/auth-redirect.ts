const FALLBACK_WEB_ORIGIN = "https://shramsewa.jeevanbhatt.com.np";

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicWebOrigin(): string {
  const configured = normalizeOrigin(
    import.meta.env.PUBLIC_SITE_URL ||
      import.meta.env.PUBLIC_WEB_URL ||
      import.meta.env.VITE_SITE_URL ||
      import.meta.env.VITE_PUBLIC_SITE_URL ||
      import.meta.env.VITE_WEB_APP_URL,
  );
  if (configured) return configured;

  if (typeof window !== "undefined" && window.location?.origin) {
    const browserOrigin = normalizeOrigin(window.location.origin);
    const host = browserOrigin ? new URL(browserOrigin).hostname : "";
    if (browserOrigin && host !== "localhost" && host !== "127.0.0.1") {
      return browserOrigin;
    }
  }

  return FALLBACK_WEB_ORIGIN;
}

export function getAuthRedirectUrl(path = "/profile"): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicWebOrigin()}${cleanPath}`;
}
