import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { bootstrapSupabase } from "./lib/supabase";
import { initSentry } from "./lib/sentry";
import "./styles.css";

bootstrapSupabase();
// Fire-and-forget: no-op when VITE_SENTRY_DSN is unset, dynamic-imports
// the SDK otherwise. Either way we don't block first paint waiting on it.
void initSentry();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
