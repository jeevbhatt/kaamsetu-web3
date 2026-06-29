import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportWebError } from "../lib/monitoring";
import { useUIStore } from "../store";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * App-wide React error boundary.
 *
 * A render-time crash anywhere below this boundary (e.g. reading a property of
 * an undefined value) would otherwise unmount the whole tree and leave the user
 * staring at a blank page — or, in dev, a raw stack trace. Instead we catch it,
 * report it for diagnostics, and show a calm, bilingual recovery screen.
 *
 * Error boundaries must be class components — there is no hook equivalent for
 * getDerivedStateFromError / componentDidCatch.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnostics only — the user never sees this.
    void reportWebError({
      category: "runtime",
      level: "error",
      message: error.message || "React render error",
      stack: error.stack,
      context: {
        source: "error-boundary",
        componentStack: info.componentStack ?? undefined,
      },
    });
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    // Read locale defensively — the store should be fine, but the boundary must
    // not itself throw while rendering the fallback.
    let isNepali = false;
    try {
      isNepali = useUIStore.getState().locale === "ne";
    } catch {
      /* fall back to English */
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-terrain-50 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-crimson-50">
            <span className="text-3xl" aria-hidden="true">
              ⚠️
            </span>
          </div>
          <h1 className="mb-2 text-xl font-bold text-mountain-900">
            {isNepali ? "केही गडबड भयो" : "Something went wrong"}
          </h1>
          <p className="mb-6 text-sm text-terrain-600">
            {isNepali
              ? "अप्रत्याशित त्रुटि भयो। कृपया पुनः प्रयास गर्नुहोस् — तपाईंको डाटा सुरक्षित छ।"
              : "An unexpected error occurred. Please try again — your data is safe."}
          </p>
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-md bg-crimson-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-crimson-800"
            >
              {isNepali ? "पुनः लोड गर्नुहोस्" : "Reload"}
            </button>
            <a
              href="/"
              className="rounded-md border border-terrain-300 px-5 py-2.5 text-sm font-medium text-mountain-900 transition-colors hover:bg-terrain-100"
            >
              {isNepali ? "गृहपृष्ठ" : "Home"}
            </a>
          </div>
        </div>
      </div>
    );
  }
}
