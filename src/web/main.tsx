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
import { Navbar } from "./components/Navbar";
import { Footer } from "./components/Footer";
import { useSettings } from "./hooks/useSettings";

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
    // useSettings already calls applyTheme on mount, but this ensures it
    // re-applies on every route change too
    if (settings.theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    }
  }, [settings.theme]);
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
          <main className="flex-1">
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/anime/:id" element={<AnimeDetail />} />
              <Route path="/watch/:id" element={<Watch />} />
              <Route path="/search" element={<Search />} />
              <Route path="/trending" element={<Trending />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/history" element={<History />} />
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
