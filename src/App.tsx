import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { setupHireOutboxSync } from "./lib/hire-outbox";
import { queryClient, setupQueryCachePersistence } from "./lib/query-client";
import { setupWebGlobalErrorMonitoring } from "./lib/monitoring";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { router } from "./router";

export default function App() {
  useEffect(() => {
    setupQueryCachePersistence();
    setupHireOutboxSync();
    return setupWebGlobalErrorMonitoring();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <RouterProvider router={router} />
        </MotionConfig>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
