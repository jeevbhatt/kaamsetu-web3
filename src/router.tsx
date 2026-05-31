import {
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
  Link,
  useRouterState,
  redirect,
} from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "framer-motion";
import { Home, Search, Trophy, UserRound, Compass } from "lucide-react";
import { Button } from "./components/ui";
import { useUIStore } from "./store";
import { useAuthStore } from "./store/auth-store";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ToastContainer } from "./components/ToastContainer";
import { useNotificationsSubscription } from "./hooks";

// Lazy load pages for code splitting
const HomePage = lazy(() => import("./pages/home"));
const SearchPage = lazy(() => import("./pages/search"));
const WorkerPage = lazy(() => import("./pages/worker"));
const HirePage = lazy(() => import("./pages/hire"));
const ProfilePage = lazy(() => import("./pages/profile"));
const LoginPage = lazy(() => import("./pages/login"));
const MostHiredPage = lazy(() => import("./pages/most-hired"));
const HowItWorksPage = lazy(() => import("./pages/how-it-works"));
const FaqPage = lazy(() => import("./pages/faq"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const TermsPage = lazy(() => import("./pages/terms"));
const GuidelinesPage = lazy(() => import("./pages/guidelines"));
const ContactPage = lazy(() => import("./pages/contact"));
const OnboardingPage = lazy(() => import("./pages/onboarding"));

// Page transition variants (from AGENTS.md section 9)
const pageVariants: Variants = {
  initial: {
    opacity: 0,
    x: 10,
    scale: 0.994,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 34,
      stiffness: 460,
      mass: 0.75,
    },
  },
  exit: {
    opacity: 0,
    x: -6,
    scale: 0.998,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1],
    },
  },
};

const reducedMotionVariants: Variants = {
  initial: { opacity: 0.95 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.1,
    },
  },
  exit: {
    opacity: 0.98,
    transition: {
      duration: 0.08,
    },
  },
};

// 404 page. Rendered inside RootLayout's <Outlet/> by TanStack Router's
// defaultNotFoundComponent, so the header, footer, and bottom nav stay
// visible — the user is never stranded on a blank page. Router-aware
// (uses <Link>) and bilingual via the UI store.
function NotFoundPage() {
  const locale = useUIStore((state) => state.locale);
  const isNepali = locale === "ne";

  return (
    <motion.div
      className="max-w-md mx-auto text-center py-16 px-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mx-auto w-16 h-16 rounded-2xl bg-crimson-50 flex items-center justify-center mb-6">
        <Compass className="w-8 h-8 text-crimson-700" />
      </div>
      <p className="text-5xl font-display font-bold text-mountain-900 mb-2">
        404
      </p>
      <h1 className="text-xl font-semibold text-mountain-900 mb-2">
        {isNepali ? "पृष्ठ फेला परेन" : "Page not found"}
      </h1>
      <p className="text-terrain-500 mb-8">
        {isNepali
          ? "तपाईंले खोज्नुभएको पृष्ठ अवस्थित छैन वा सारिएको हुन सक्छ।"
          : "The page you're looking for doesn't exist or may have moved."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link to="/" preload="intent">
          <Button className="rounded-full w-full sm:w-auto gap-2">
            <Home className="w-4 h-4" />
            {isNepali ? "गृह पृष्ठ" : "Go home"}
          </Button>
        </Link>
        <Link to="/search" preload="intent">
          <Button
            variant="outline"
            className="rounded-full w-full sm:w-auto gap-2"
          >
            <Search className="w-4 h-4" />
            {isNepali ? "कामदार खोज्नुहोस्" : "Find workers"}
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// Loading fallback with animation
function PageLoader() {
  const isNepali = useUIStore((state) => state.locale === "ne");
  return (
    <motion.div
      className="flex items-center justify-center min-h-[45vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-crimson-200 border-b-crimson-700" />
        <span className="text-sm text-mountain-700">
          {isNepali ? "लोड हुँदै..." : "Loading"}
        </span>
      </div>
    </motion.div>
  );
}

// Animated page wrapper
function AnimatedOutlet() {
  const routerState = useRouterState();
  const reduceMotion = useReducedMotion();
  const pathname = routerState.location.pathname;
  const variants = reduceMotion ? reducedMotionVariants : pageVariants;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

// Root layout with navigation
function RootLayout() {
  const { theme, locale } = useUIStore();
  const initializeAuth = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  useNotificationsSubscription(isAuthenticated);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    const resolvedTheme =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.setAttribute("data-locale", locale);
    document.documentElement.lang = locale === "ne" ? "ne" : "en";
  }, [theme, locale]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="container mx-auto px-4 pt-3 pb-24 md:pt-5 md:pb-10 flex-1">
        <AnimatedOutlet />
      </main>

      <Footer />

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-terrain-200 bg-white/95 backdrop-blur px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-4 gap-1">
          {[
            {
              to: "/",
              label: locale === "ne" ? "होम" : "Home",
              icon: Home,
            },
            {
              to: "/search",
              label: locale === "ne" ? "खोज" : "Search",
              icon: Search,
            },
            {
              to: "/most-hired",
              label: locale === "ne" ? "शीर्ष" : "Top",
              icon: Trophy,
            },
            {
              to: "/profile",
              label: locale === "ne" ? "प्रोफाइल" : "Profile",
              icon: UserRound,
            },
          ].map((item) => {
            const isActive =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center rounded-xl py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-crimson-50 text-crimson-800"
                    : "text-terrain-500 active:bg-terrain-100"
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <ToastContainer />
    </div>
  );
}

// Define root route
const rootRoute = createRootRoute({
  component: RootLayout,
});

/**
 * Await auth initialization and redirect unauthenticated users to /login.
 * Fix 6: Read state once after await to avoid race where isLoading=true
 * causes a stale isAuthenticated=false read.
 */
async function requireAuth() {
  const authState = useAuthStore.getState();

  // Wait for initialization to complete before reading isAuthenticated
  if (authState.isLoading) {
    await authState.initialize();
  }

  // Read state once after initialization is guaranteed complete
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) {
    throw redirect({ to: "/login" });
  }
}

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  beforeLoad: requireAuth,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      {/* Dynamic import so it splits out */}
      <OnboardingPage />
    </Suspense>
  ),
});

async function requireProfile() {
  await requireAuth();
  const { isProfileComplete } = useAuthStore.getState();
  if (!isProfileComplete()) {
    throw redirect({ to: "/onboarding" });
  }
}

// Define routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <HomePage />
    </Suspense>
  ),
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <SearchPage />
    </Suspense>
  ),
});

const mostHiredRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/most-hired",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <MostHiredPage />
    </Suspense>
  ),
});

const workerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/worker/$workerId",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <WorkerPage />
    </Suspense>
  ),
});

const hireRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/hire/$workerId",
  beforeLoad: requireProfile,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <HirePage />
    </Suspense>
  ),
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  beforeLoad: requireProfile,
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ProfilePage />
    </Suspense>
  ),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  // Fix 4: redirect already-authenticated users away from the login page
  beforeLoad: async () => {
    const authState = useAuthStore.getState();
    if (authState.isLoading) {
      await authState.initialize();
    }
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      throw redirect({ to: "/profile" });
    }
  },
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <LoginPage />
    </Suspense>
  ),
});

const howItWorksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/how-it-works",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <HowItWorksPage />
    </Suspense>
  ),
});

const faqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/faq",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <FaqPage />
    </Suspense>
  ),
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <PrivacyPage />
    </Suspense>
  ),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <TermsPage />
    </Suspense>
  ),
});

const guidelinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/guidelines",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <GuidelinesPage />
    </Suspense>
  ),
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/contact",
  component: () => (
    <Suspense fallback={<PageLoader />}>
      <ContactPage />
    </Suspense>
  ),
});

// Create route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  mostHiredRoute,
  workerRoute,
  hireRoute,
  profileRoute,
  onboardingRoute,
  loginRoute,
  howItWorksRoute,
  faqRoute,
  privacyRoute,
  termsRoute,
  guidelinesRoute,
  contactRoute,
]);

// Create router
export const router = createRouter({
  routeTree,
  // Any unmatched URL renders the 404 inside RootLayout's <Outlet/>.
  defaultNotFoundComponent: NotFoundPage,
});

// Type declaration for type-safe routing
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
