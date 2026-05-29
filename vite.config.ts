import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
const middlewareMode = process.env.VITE_MIDDLEWARE_MODE === "true";

export default defineConfig({
  envPrefix: ["VITE_", "PUBLIC_"],
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Sentry's lazy chunk is dynamic-imported only when VITE_SENTRY_DSN
      // is set. Excluding it from the precache manifest means users
      // without Sentry don't pay the ~141 kB gzipped download cost on
      // their first PWA install — critical for our 2G Nepal target.
      workbox: {
        globIgnores: ["**/sentry-vendor-*.js"],
      },
      manifest: {
        name: "श्रम सेवा — Nepal Manpower",
        short_name: "श्रम सेवा",
        lang: "ne",
        description: "Nepal Local Government Manpower Platform",
        theme_color: "#7C1D2B",
        background_color: "#FAF7F0",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    rollupOptions: {
      output: {
        // Order matters: each rule short-circuits, so more specific
        // identifiers must come BEFORE broader matches.
        //
        // Why so explicit? The previous rule `id.includes("react")` was
        // catching every package whose name contained "react" (e.g.
        // react-hook-form, react-dom-router-utils), pulling them into the
        // react-vendor chunk and creating a circular dependency between
        // vendor → react-vendor → vendor. We now match react/react-dom/
        // scheduler at the node_modules directory boundary so unrelated
        // packages stay in `vendor`.
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("/node_modules/framer-motion/")) {
            return "motion";
          }

          if (id.includes("/node_modules/@tanstack/react-router/")) {
            return "router";
          }

          if (id.includes("/node_modules/@tanstack/react-query")) {
            return "query";
          }

          if (id.includes("/node_modules/lucide-react/")) {
            return "icons";
          }

          if (id.includes("/node_modules/@radix-ui/")) {
            return "radix";
          }

          if (
            id.includes("/node_modules/react-hook-form/") ||
            id.includes("/node_modules/@hookform/")
          ) {
            return "forms";
          }

          // Sentry is loaded via dynamic import in lib/sentry.ts, ONLY when
          // VITE_SENTRY_DSN is set. Route both @sentry/* and the
          // @sentry-internal/* sub-packages to one lazy chunk so the
          // dynamic-import boundary actually pays off — without these
          // rules they fall into `vendor` and ship eagerly for every user.
          if (
            id.includes("/node_modules/@sentry/") ||
            id.includes("/node_modules/@sentry-internal/")
          ) {
            return "sentry-vendor";
          }

          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // dedupe still enforces single-version semantics for these packages
    // across the workspace, but we no longer pin them to apps/web/node_modules
    // because pnpm's hoisted node-linker installs them at the root
    // node_modules/ (apps/web/node_modules only ends up with packages that
    // need workspace-specific versions). Hard-coded paths broke after the
    // SDK 52 reinstall reshuffled the install layout.
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  server: {
    fs: {
      // Ensure linked workspace packages outside apps/web are watchable in dev.
      allow: [
        path.resolve(__dirname),
        path.resolve(__dirname, "../../packages"),
      ],
    },
    ...(middlewareMode
      ? {
          middlewareMode: true,
        }
      : {}),
  },
});
