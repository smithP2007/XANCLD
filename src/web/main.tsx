import { StrictMode, useEffect, useState, Suspense, lazy, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./index.css";
import { Landing } from "./routes/Landing";
import { Home } from "./routes/Home";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { CommandMenu } from "./components/command/CommandMenu";
import { useSettings, applyTheme, applyThemePreset, applyRuntimeFlags, type MoodPreference, type DurationPreference } from "./hooks/useSettings";
import { OnboardingSheet } from "./components/OnboardingSheet";
import { AlertCircle } from "lucide-react";

// B7 FIX: route-level code splitting. All 13 routes used to land in ONE
// initial bundle (the 500 kB+ chunk warning on every build) even though a
// typical session touches 3-4 of them. Landing + Home stay eager (entry
// points / first paint); everything else is a separate chunk fetched on
// first navigation. index.html pairs this with a chunk-load-failure banner
// so a deploy that swaps hashed files shows "new version" instead of a
// blank screen.
const Watch = lazy(() => import("./routes/Watch").then((m) => ({ default: m.Watch })));
const AnimeDetail = lazy(() => import("./routes/AnimeDetail").then((m) => ({ default: m.AnimeDetail })));
const Search = lazy(() => import("./routes/Search").then((m) => ({ default: m.Search })));
const Trending = lazy(() => import("./routes/Trending").then((m) => ({ default: m.Trending })));
const Schedule = lazy(() => import("./routes/Schedule").then((m) => ({ default: m.Schedule })));
const History = lazy(() => import("./routes/History").then((m) => ({ default: m.History })));
const Settings = lazy(() => import("./routes/Settings").then((m) => ({ default: m.Settings })));
const MyLibrary = lazy(() => import("./routes/MyLibrary").then((m) => ({ default: m.MyLibrary })));
const Browse = lazy(() => import("./routes/Browse").then((m) => ({ default: m.Browse })));
const Character = lazy(() => import("./routes/Character").then((m) => ({ default: m.Character })));

// Lightweight Suspense fallback that matches the app's spinner language.
function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]" role="status" aria-label="Loading page">
      <div className="h-8 w-8 rounded-full border-2 border-xan-crimson border-t-transparent animate-spin" />
    </div>
  );
}

// H-8 FIX: Error Boundary — prevents white-screen crashes when a component
// throws during render (e.g. undefined.map() from a malformed API response).
// Shows a retry button instead of a blank page.
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
          <AlertCircle className="h-12 w-12 text-xan-crimson mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet text-white font-semibold shadow-lg"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Apply theme on every route change — ensures light/dark + preset persists across navigation
function ThemeApplier() {
  const [settings] = useSettings();
  useEffect(() => {
    applyTheme(settings.theme);
    applyThemePreset(settings.themePreset);
    applyRuntimeFlags(settings);
  }, [settings.theme, settings.themePreset, settings.reducedMotion, settings.tvMode]);
  return null;
}

// Show the one-time onboarding sheet on first visit (redesign plan §5).
// Tracked via settings.hasSeenOnboarding. Reset from Settings > Data.
function OnboardingGate() {
  const [settings, update] = useSettings();
  // Local "dismissed this session" state — once dismissed (skip or complete),
  // don't reopen even if the user navigates around (until they reset it).
  const [dismissed, setDismissed] = useState(false);
  const open = !settings.hasSeenOnboarding && !dismissed;

  const handleComplete = (mood: MoodPreference, duration: DurationPreference) => {
    update({
      hasSeenOnboarding: true,
      moodPreference: mood,
      durationPreference: duration,
    });
    setDismissed(true);
  };
  const handleSkip = () => {
    update({ hasSeenOnboarding: true });
    setDismissed(true);
  };

  return (
    <OnboardingSheet
      open={open}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
}

function AppShell() {
  const { pathname } = useLocation();
  // Landing page is full-screen (no navbar/footer)
  const isLanding = pathname === "/";

  return (
    <>
      <ThemeApplier />
      <ScrollToTop />
      <OnboardingGate />
      {isLanding ? (
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      ) : (
        // v4.1 MINIMAL layout: content shifts right of the icon-only sidebar
        // rail (rail 68px + left 16px + gap 20px = 104px). Mobile keeps a slim
        // top bar (h-14) plus bottom clearance for the capsule dock.
        <div className="min-h-screen flex flex-col pb-24 md:pb-6 md:pl-[104px]">
          <Navbar />
          <main className="flex-1 pt-14 md:pt-0">
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/home" element={<Home />} />
                <Route path="/anime/:id" element={<AnimeDetail />} />
                <Route path="/character/:id" element={<Character />} />
                <Route path="/watch/:id" element={<Watch />} />
                <Route path="/search" element={<Search />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/trending" element={<Trending />} />
                <Route path="/schedule" element={<Schedule />} />
                <Route path="/history" element={<History />} />
                <Route path="/list" element={<MyLibrary />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      )}
      {/* ─── Command Menu (⌘K) — mounted globally so it's available on
          every page, including the Landing page. Listens for the
          ⌘K / "/" hotkeys and the Navbar's openCommandMenu() event. */}
      <CommandMenu />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
