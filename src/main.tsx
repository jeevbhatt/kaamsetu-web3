import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { bootstrapSupabase } from "./lib/supabase";
import { initSentry } from "./lib/sentry";
import "./styles.css";

// After a new deploy, a browser holding the old index.html tries to lazy-load
// old hashed chunks (e.g. profile-XXXX.js) that no longer exist -> Vite fires
// "vite:preloadError". Reload once to pick up the fresh index.html + new chunks.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const KEY = "vite-preload-reloaded-at";
  const last = Number(sessionStorage.getItem(KEY) ?? "0");
  // Reload at most once per 10s so a genuinely broken chunk can't loop forever.
  if (Date.now() - last > 10_000) {
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }
});

bootstrapSupabase();
// Fire-and-forget: no-op when VITE_SENTRY_DSN is unset, dynamic-imports
// the SDK otherwise. Either way we don't block first paint waiting on it.
void initSentry();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
