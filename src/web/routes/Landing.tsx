import { Link } from "react-router-dom";
import { Play, ArrowRight, Shuffle } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchTrending } from "../lib/anilist";
import { Logo } from "../components/Logo";

// v4 ROSA: centered editorial layout. Enter-to-enter and Surprise Me are
// preserved.
// v4.2.2 SIMPLIFIED: removed the numbered trending rows, the feature tiles,
// the gradient CTA panel and the floating glass chips.
// v4.2.3 (user request: "remove that big banner from title page"): the
// framed showcase banner is gone too. No AniList request fires on load
// anymore (only Surprise Me fetches on click).
// v4.2.4 (user request: "remove footer in title page"): the footer strip is
// gone — the SUNDEEP signature is now the final element. The plain XAN text
// wordmark is replaced with the new "Guiding Light" logo (Logo.tsx).
// v4.2.5 (user request: "change position of everything to center of the
// page"): fully symmetric composition — the top bar is now a CENTERED brand
// group (logo + CTA side by side on the page axis), the hero floats at the
// vertical center of the viewport (flex-1 + justify-center instead of a
// fixed top padding), and the SUNDEEP signature sits bottom-CENTER with
// mirrored gradient hairlines on both sides.
// v4.2.6 (user request: "SUNDEEP also centred, not at bottom most part"):
// the signature is no longer pinned to the page bottom (mt-auto removed) —
// it now lives INSIDE the centered hero flow, right after the Enter hint,
// so the whole composition (brand bar → hero → signature) reads as one
// centered group on the page axis.
// v4.2.7 (user request: "XAN on top with start watching centred to center,
// not at top most part"): the fixed top bar is GONE. The brand group
// (XAN logo | divider | Start Watching) now LEADS the centered stack as its
// first element, so it floats in the upper-center of the page instead of
// hugging the top edge. Final composition, all on the page axis:
// brand group → eyebrow → headline → copy → CTAs → Enter hint → SUNDEEP.
export function Landing() {
  const [surpriseId, setSurpriseId] = useState<number | null>(null);

  // Press Enter to enter the app
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      // Ignore Enter when an interactive element has focus.
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return;
      }
      if (el?.isContentEditable) return;
      window.location.href = "/home";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // "Surprise Me" — pick a random trending anime and navigate to its detail page.
  const handleSurprise = async () => {
    try {
      const trending = await fetchTrending(20);
      if (trending.length > 0) {
        const pick = trending[Math.floor(Math.random() * trending.length)];
        setSurpriseId(pick.id);
        window.location.href = `/anime/${pick.id}`;
      } else {
        window.location.href = "/home";
      }
    } catch {
      window.location.href = "/home";
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-xan-dark text-white">
      {/* ─── One centered composition: brand group → hero → signature ─── */}
      {/* items-center: as a flex column its children would otherwise
          stretch full-width (the eyebrow chip did exactly that). */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center md:py-12">
        {/* Brand group — XAN logo | divider | Start Watching. Leads the
            centered stack: floats in the upper-center of the page, NOT
            glued to the top edge (the fixed bar is gone). */}
        <div className="flex items-center justify-center gap-4 md:gap-5">
          <Link
            to="/home"
            className="transition-opacity hover:opacity-85"
            aria-label="XAN home"
          >
            <Logo
              markClassName="h-9 w-9 rounded-[11px] drop-shadow-[0_4px_18px_rgba(233,69,96,0.4)] md:h-10 md:w-10"
              wordClassName="text-white"
            />
          </Link>
          <span className="h-6 w-px bg-white/15 md:h-7" aria-hidden="true" />
          <Link to="/home" className="btn-aurora flex h-10 items-center px-5 text-sm font-bold md:h-11 md:px-7">
            Start Watching
          </Link>
        </div>

        <span className="mt-14 inline-flex items-center gap-2 rounded-full border border-xan-violet/40 bg-xan-violet/10 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-xan-cyan md:mt-16">
          Anime, uninterrupted
        </span>

        <h1 className="mx-auto mt-6 max-w-4xl font-display text-5xl font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          Unlimited anime.
          <br />
          <span className="gradient-text">Zero noise.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base font-medium leading-relaxed text-white/65 md:text-lg">
          Trending shows, HD streams, and a home feed tuned to your taste — no ads,
          no accounts, no clutter. Just press play.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/home" className="btn-aurora inline-flex h-12 items-center gap-2 px-8 text-base font-bold">
            <Play className="h-5 w-5 fill-white" />
            Start Watching
            <ArrowRight className="h-4.5 w-4.5" />
          </Link>
          <button
            type="button"
            onClick={handleSurprise}
            disabled={surpriseId !== null}
            className="glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-base font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-60"
          >
            <Shuffle className="h-4.5 w-4.5" />
            Surprise Me
          </button>
        </div>

        <p className="mt-5 text-xs text-white/40">
          Press{" "}
          <kbd className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70">
            Enter
          </kbd>{" "}
          to explore
        </p>

        {/* ─── Signature — SUNDEEP, part of the centered group ─── */}
        {/* Lives inside the centered flow (NOT pinned to the page bottom);
            mirrored gradient hairlines keep it symmetric on the axis. */}
        <div className="mt-10 flex items-center justify-center gap-2.5 select-none md:mt-12" aria-hidden="true">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-xan-crimson/50" />
          <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.38em] text-white/40">
            SUNDEEP
          </span>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-xan-crimson/50" />
        </div>
      </section>
    </div>
  );
}
