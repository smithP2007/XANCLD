import { Link } from "react-router-dom";
import { Play, ArrowRight } from "lucide-react";
import { useEffect } from "react";

export function Landing() {
  // Press Enter to enter the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        window.location.href = "/home";
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient with animated blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/10 via-background to-xan-violet/10" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-xan-crimson/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-xan-violet/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: "6s", animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-xan-crimson/5 rounded-full blur-3xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-2xl animate-fade-in-up">
        <Link to="/home" className="inline-flex items-center gap-3 mb-8 group">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl shadow-xan-crimson/40 pulse-glow">
            <Play className="h-8 w-8 text-white fill-white" />
          </div>
          <span className="font-display font-extrabold text-5xl tracking-tight">XAN</span>
        </Link>

        <h1 className="text-4xl md:text-7xl font-bold font-display mb-6 leading-tight">
          Stream anime
          <br />
          <span className="gradient-text">without the noise.</span>
        </h1>

        <p className="text-lg text-muted-foreground mb-10 max-w-md mx-auto leading-relaxed">
          A modern anime streaming experience. Browse trending shows, search your
          favorites, and watch in HD.
        </p>

        <Link
          to="/home"
          className="btn-premium inline-flex items-center gap-2 px-10 py-4 rounded-2xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark hover:from-xan-crimson-dark hover:to-xan-crimson font-semibold text-white transition-all shadow-2xl shadow-xan-crimson/40 hover:shadow-xan-crimson/60 hover:scale-105"
        >
          Start Watching
          <ArrowRight className="h-5 w-5" />
        </Link>

        <p className="mt-10 text-xs text-muted-foreground">
          Press <kbd className="px-2 py-0.5 rounded-md glass font-mono text-[10px]">Enter</kbd> to explore
        </p>

        {/* Feature pills */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {["10k+ titles", "HD streaming", "Free forever"].map((f) => (
            <span key={f} className="px-3 py-1 rounded-full glass text-xs text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
