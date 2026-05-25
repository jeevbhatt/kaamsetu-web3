import fs from "node:fs";
import path from "node:path";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const content = fs.readFileSync(filePath, "utf8");
  const result = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadEnv() {
  const cwd = process.cwd();
  const root = path.resolve(cwd, "..", "..");
  const env = {
    ...readEnvFile(path.join(root, ".env")),
    ...readEnvFile(path.join(root, ".env.local")),
    ...readEnvFile(path.join(cwd, ".env")),
    ...readEnvFile(path.join(cwd, ".env.local")),
    ...process.env,
  };

  return env;
}

async function requestOtp({ baseUrl, anonKey, phone, email }) {
  const payload = phone
    ? { phone, channel: "sms", create_user: true }
    : { email, create_user: true };

  const response = await fetch(`${baseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return { ok: response.ok, status: response.status, body };
}

async function main() {
  const env = loadEnv();
  const baseUrl = env.PUBLIC_SUPABASE_URL;
  // Mirror apps/web/src/lib/supabase.ts: accept the modern publishable
  // key as a fallback to the older anon-key naming so newer Supabase
  // projects don't need to set both.
  const anonKey =
    env.PUBLIC_SUPABASE_ANON_KEY ||
    env.PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  const testPhone = env.AUTH_TEST_PHONE_E164;
  const testEmail = env.AUTH_TEST_EMAIL;

  if (!baseUrl || !anonKey) {
    console.error(
      "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY / PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    process.exit(1);
  }

  console.log(`Supabase URL: ${baseUrl}`);
  console.log(
    `Key fingerprint: ${anonKey.slice(0, 12)}…${anonKey.slice(-6)} (${anonKey.length} chars)`,
  );
  console.log("\nChecking Supabase auth settings endpoint...");
  const settingsRes = await fetch(`${baseUrl}/auth/v1/settings`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });

  if (!settingsRes.ok) {
    console.error(`Failed: /auth/v1/settings -> ${settingsRes.status}`);
    process.exit(1);
  }

  // Print provider toggles so we can see at a glance whether phone OTP
  // is enabled and which external providers are configured.
  try {
    const settings = await settingsRes.json();
    console.log("OK: Supabase auth endpoint reachable.");
    console.log(
      "  external providers:",
      Object.keys(settings.external ?? {})
        .filter((k) => settings.external[k] === true)
        .join(", ") || "(none)",
    );
    if (settings.external?.phone !== undefined) {
      console.log(`  phone provider enabled: ${settings.external.phone}`);
    }
    if (typeof settings.disable_signup === "boolean") {
      console.log(`  disable_signup: ${settings.disable_signup}`);
    }
    if (typeof settings.mailer_autoconfirm === "boolean") {
      console.log(`  mailer_autoconfirm: ${settings.mailer_autoconfirm}`);
    }
  } catch {
    console.log("OK: Supabase auth endpoint reachable.");
  }

  if (!testPhone && !testEmail) {
    console.log(
      "No AUTH_TEST_PHONE_E164 or AUTH_TEST_EMAIL set. Skipping OTP send checks.",
    );
    console.log(
      "Set one/both in .env.local and rerun this script to verify delivery path.",
    );
    return;
  }

  if (testPhone) {
    console.log(`Checking phone OTP request for ${testPhone} ...`);
    const result = await requestOtp({ baseUrl, anonKey, phone: testPhone });
    if (result.ok) {
      console.log("OK: Phone OTP request accepted by Supabase.");
    } else {
      console.error(
        `FAILED: Phone OTP request (${result.status}) -> ${JSON.stringify(result.body)}`,
      );
      process.exitCode = 1;
    }
  }

  if (testEmail) {
    console.log(`Checking email OTP/magic-link request for ${testEmail} ...`);
    const result = await requestOtp({ baseUrl, anonKey, email: testEmail });
    if (result.ok) {
      console.log("OK: Email OTP/magic-link request accepted by Supabase.");
    } else {
      console.error(
        `FAILED: Email OTP/magic-link request (${result.status}) -> ${JSON.stringify(result.body)}`,
      );
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("Auth setup check failed:", error);
  process.exit(1);
});
