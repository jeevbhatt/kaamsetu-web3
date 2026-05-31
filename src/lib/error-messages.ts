/**
 * Centralized, user-friendly error translation.
 *
 * GOAL: the client UI must NEVER show a raw Supabase / Postgres / HTTP
 * error string or a numeric status code to an end user. Rural Nepal users
 * (many low-literacy, low-tech-familiarity) need a plain sentence telling
 * them what happened and what to do — in their language.
 *
 * Every catch block that renders to the screen should route its error
 * through `translateError(err, isNepali)` instead of `err.message`.
 *
 * The function inspects the structured fields on the error object
 * (Postgres `code`, GoTrue auth `code`/`status`, fetch network failures)
 * and maps them to a curated bilingual message. Anything unrecognized
 * falls back to a safe generic message — we deliberately do NOT echo the
 * underlying message, because those leak table names, constraint names,
 * and SQL fragments.
 */

export interface TranslateOptions {
  /** Whether to return the Nepali copy. */
  isNepali: boolean;
  /**
   * Optional hint about what the user was doing, so the same Postgres
   * code can produce a more specific sentence. e.g. a 23505 during
   * worker registration → "already registered", during hire → "already
   * requested".
   */
  context?:
    | "register"
    | "hire"
    | "profile"
    | "login"
    | "otp"
    | "generic";
}

type Bilingual = { en: string; ne: string };

function pick(msg: Bilingual, isNepali: boolean): string {
  return isNepali ? msg.ne : msg.en;
}

// ─── Generic fallbacks ──────────────────────────────────────────────────
const GENERIC: Bilingual = {
  en: "Something went wrong. Please try again.",
  ne: "केही गडबड भयो। कृपया फेरि प्रयास गर्नुहोस्।",
};

const NETWORK: Bilingual = {
  en: "No internet connection. Check your network and try again.",
  ne: "इन्टरनेट जडान छैन। आफ्नो नेटवर्क जाँच गरी फेरि प्रयास गर्नुहोस्।",
};

const UNAVAILABLE: Bilingual = {
  en: "The service is temporarily unavailable. Please try again shortly.",
  ne: "सेवा अहिले अस्थायी रूपमा उपलब्ध छैन। कृपया केही बेरमा प्रयास गर्नुहोस्।",
};

const PERMISSION: Bilingual = {
  en: "You don't have permission to do that.",
  ne: "तपाईंलाई यो गर्ने अनुमति छैन।",
};

const RATE_LIMIT: Bilingual = {
  en: "Too many attempts. Please wait a minute and try again.",
  ne: "धेरै पटक प्रयास भयो। कृपया एक मिनेट पर्खेर फेरि प्रयास गर्नुहोस्।",
};

// ─── Context-specific "already exists" copy ─────────────────────────────
function duplicateMessage(context: TranslateOptions["context"]): Bilingual {
  switch (context) {
    case "register":
      return {
        en: "You are already registered as a worker. You can update your details from your profile.",
        ne: "तपाईं पहिले नै कामदारको रूपमा दर्ता हुनुभएको छ। प्रोफाइलबाट विवरण अद्यावधिक गर्न सक्नुहुन्छ।",
      };
    case "hire":
      return {
        en: "You have already sent a hire request to this worker from this location.",
        ne: "तपाईंले यस स्थानबाट यस कामदारलाई पहिले नै भाडा अनुरोध पठाइसक्नुभएको छ।",
      };
    default:
      return {
        en: "This already exists.",
        ne: "यो पहिले नै अवस्थित छ।",
      };
  }
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    // fetch() throws TypeError "Failed to fetch" / "Network request failed"
    const m = error.message.toLowerCase();
    return (
      m.includes("failed to fetch") ||
      m.includes("network request failed") ||
      m.includes("load failed")
    );
  }
  if (typeof error === "object" && error) {
    const name = (error as { name?: string }).name;
    if (name === "AbortError") return true;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }
  return false;
}

/**
 * Extract a known structured code from any of the error shapes we deal
 * with (Postgrest, GoTrue auth, plain objects).
 */
function extractCode(error: unknown): { code?: string; status?: number } {
  if (!error || typeof error !== "object") return {};
  const e = error as { code?: unknown; status?: unknown };
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
  };
}

/**
 * Translate any thrown error into a friendly, localized, code-free string.
 */
export function translateError(
  error: unknown,
  options: TranslateOptions,
): string {
  const { isNepali, context = "generic" } = options;

  // 1. Network first — most common failure for 2G/3G users.
  if (isNetworkError(error)) {
    return pick(NETWORK, isNepali);
  }

  const { code, status } = extractCode(error);

  // 2. Postgres error codes (Postgrest surfaces SQLSTATE in `code`).
  switch (code) {
    case "23505": // unique_violation
      return pick(duplicateMessage(context), isNepali);
    case "23503": // foreign_key_violation
      return pick(
        {
          en: "Some of the selected options are no longer valid. Please re-check and try again.",
          ne: "केही छनोट गरिएका विकल्पहरू अब मान्य छैनन्। कृपया पुन: जाँच गरी प्रयास गर्नुहोस्।",
        },
        isNepali,
      );
    case "23514": // check_violation
      return pick(
        {
          en: "Some details are out of the allowed range. Please review your entries.",
          ne: "केही विवरण अनुमत दायरा बाहिर छन्। कृपया आफ्ना प्रविष्टिहरू समीक्षा गर्नुहोस्।",
        },
        isNepali,
      );
    case "42501": // insufficient_privilege (RLS)
      return pick(PERMISSION, isNepali);
    case "over_request_rate_limit":
      return pick(RATE_LIMIT, isNepali);
    case "phone_provider_disabled":
    case "sms_send_failed":
      return pick(
        {
          en: "SMS service is unavailable right now. Please try email login instead.",
          ne: "SMS सेवा अहिले उपलब्ध छैन। कृपया इमेल लगइन प्रयोग गर्नुहोस्।",
        },
        isNepali,
      );
    case "otp_expired":
      return pick(
        {
          en: "That code has expired. Request a new OTP.",
          ne: "यो कोड म्याद सकियो। नयाँ OTP अनुरोध गर्नुहोस्।",
        },
        isNepali,
      );
    case "invalid_credentials":
      return pick(
        {
          en: "The login details are incorrect. Please check and try again.",
          ne: "लगइन विवरण मिलेन। कृपया जाँच गरी फेरि प्रयास गर्नुहोस्।",
        },
        isNepali,
      );
    default:
      break;
  }

  // 3. HTTP-ish status fallbacks (auth errors carry numeric `status`).
  if (status === 429) return pick(RATE_LIMIT, isNepali);
  if (status === 401 || status === 403) return pick(PERMISSION, isNepali);
  if (status === 409) return pick(duplicateMessage(context), isNepali);
  if (typeof status === "number" && status >= 500) {
    return pick(UNAVAILABLE, isNepali);
  }

  // 4. String-pattern sniffing for libraries that only give a message.
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes("duplicate") || m.includes("already registered")) {
      return pick(duplicateMessage(context), isNepali);
    }
    if (m.includes("already exists") || m.includes("already been")) {
      return pick(duplicateMessage(context), isNepali);
    }
    if (m.includes("permission") || m.includes("not allowed") || m.includes("rls")) {
      return pick(PERMISSION, isNepali);
    }
    if (m.includes("not configured") || m.includes("unavailable")) {
      return pick(UNAVAILABLE, isNepali);
    }
  }

  // 5. Last resort — generic, never the raw text.
  return pick(GENERIC, isNepali);
}
