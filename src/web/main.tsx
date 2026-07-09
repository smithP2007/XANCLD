import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./index.css";
import { Landing } from "./routes/Landing";
import { Home } from "./routes/Home";
import { Watch } from "./routes/Watch";
import { AnimeDetail } from "./routes/AnimeDetail";
import { Search } from "./routes/Search";
import { Trending } from "./routes/Trending";
import { Schedule } from "./routes/Schedule";
import { History } from "./routes/History";
import { Settings } from "./routes/Settings";
import { MyLibrary } from "./routes/MyLibrary";
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { useSettings, applyTheme, applyRuntimeFlags } from "./hooks/useSettings";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Apply theme on every route change — ensures light/dark persists across navigation
function ThemeApplier() {
  const [settings] = useSettings();
  useEffect(() => {
    applyTheme(settings.theme);
    applyRuntimeFlags(settings);
  }, [settings.theme, settings.reducedMotion, settings.tvMode]);
  return null;
}

function AppShell() {
  const { pathname } = useLocation();
  // Landing page is full-screen (no navbar/footer)
  const isLanding = pathname === "/";

  return (
    <>
      <ThemeApplier />
      <ScrollToTop />
      {isLanding ? (
        <Routes>
          <Route path="/" element={<Landing />} />
        </Routes>
      ) : (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 pt-16">
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/search" element={<Search />} />
              <Route path="/trending" element={<Trending />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/history" element={<History />} />
              <Route path="/list" element={<MyLibrary />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
          <Footer />
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </StrictMode>,
);
