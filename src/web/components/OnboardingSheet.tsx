import { useState, useEffect, useRef } from "react";
import { Sparkles, Clock, X, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { XaniMascot } from "./XaniMascot";
import { lockBodyScroll, unlockBodyScroll } from "../lib/bodyScrollLock";
import type { MoodPreference, DurationPreference } from "../hooks/useSettings";

interface Props {
  open: boolean;
  onComplete: (mood: MoodPreference, duration: DurationPreference) => void;
  onSkip: () => void;
}

/**
 * OnboardingSheet — one-time, dismissible sheet shown on first visit.
 *
 * Per the redesign plan §5: 2 questions (mood + duration). The sub/dub
 * question is intentionally omitted because the underlying provider data
 * doesn't reliably distinguish sub/dub (plan's own caveat).
 *
 * Tracked via `hasSeenOnboarding` flag in XanSettings. Reset from
 * Settings > Data.
 *
 * Answers are stored in XanSettings and used ONLY inside recommend.ts —
 * never sent anywhere or stored server-side.
 */
const MOOD_OPTIONS: { id: MoodPreference; label: string; emoji: string; desc: string }[] = [
  { id: "action",   label: "Action",   emoji: "🔥", desc: "High-energy fights, mecha, adventure" },
  { id: "cozy",     label: "Cozy",     emoji: "🍵", desc: "Slice of life, gentle fantasy" },
  { id: "funny",    label: "Funny",    emoji: "😂", desc: "Comedy, gag, feel-good" },
  { id: "romance",  label: "Romance",  emoji: "💗", desc: "Love stories, slow burns" },
  { id: "mystery",  label: "Mystery",  emoji: "🔍", desc: "Whodunits, thrillers, mind-benders" },
  { id: "dark",     label: "Dark",     emoji: "🌑", desc: "Horror, psychological, drama" },
  { id: "surprise", label: "Surprise", emoji: "🎲", desc: "Mix it up — no preference" },
];

const DURATION_OPTIONS: { id: DurationPreference; label: string; desc: string }[] = [
  { id: "short",  label: "20 minutes",   desc: "Quick episode or a short series" },
  { id: "medium", label: "1-2 hours",    desc: "A few episodes or a movie" },
  { id: "long",   label: "Weekend binge", desc: "A long-running series" },
  { id: "any",    label: "No preference", desc: "Show me everything" },
];

export function OnboardingSheet({ open, onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0); // 0 = mood, 1 = duration
  const [mood, setMood] = useState<MoodPreference | null>(null);
  const [duration, setDuration] = useState<DurationPreference | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Reset state when reopened + focus trap setup
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setStep(0);
    setMood(null);
    setDuration(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onSkip]);

  if (!open) return null;

  const handleComplete = () => {
    onComplete(
      mood ?? "surprise",
      duration ?? "any",
    );
  };

  const canAdvance = step === 0 ? mood !== null : duration !== null;
  const isLastStep = step === 1;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Skip onboarding"
        onClick={onSkip}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />

      {/* Sheet — bottom-sheet on mobile, centered modal on desktop */}
      <div className="relative w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl glass-strong border border-xan-border shadow-[0_25px_70px_rgba(0,0,0,0.7)] animate-panel-up max-h-[90vh] overflow-y-auto">
        {/* Skip button */}
        <button
          type="button"
          onClick={onSkip}
          aria-label="Skip"
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <XaniMascot mood="happy" size={72} className="mb-3" />
            <h2 id="onboarding-title" className="font-display font-bold text-2xl text-foreground">
              Welcome to XAN
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Two quick questions to tune your Home feed. Skip anytime — you can change these later in Settings.
            </p>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-8 bg-xan-crimson" : i < step ? "w-2 bg-xan-crimson/60" : "w-2 bg-white/15"
                }`}
              />
            ))}
          </div>

          {/* Step 0 — Mood */}
          {step === 0 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-xan-crimson" />
                <h3 className="font-semibold text-foreground">What are you in the mood for?</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MOOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMood(opt.id)}
                    aria-pressed={mood === opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      mood === opt.id
                        ? "border-xan-crimson/60 bg-xan-crimson/10 shadow-[0_0_0_1px_rgba(233,69,96,0.3)]"
                        : "border-xan-border bg-xan-card hover:border-xan-crimson/40 hover:bg-xan-card-hover"
                    }`}
                  >
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                        {mood === opt.id && <Check className="h-3.5 w-3.5 text-xan-crimson" />}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1 — Duration */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-xan-crimson" />
                <h3 className="font-semibold text-foreground">How much time do you have?</h3>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDuration(opt.id)}
                    aria-pressed={duration === opt.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      duration === opt.id
                        ? "border-xan-crimson/60 bg-xan-crimson/10 shadow-[0_0_0_1px_rgba(233,69,96,0.3)]"
                        : "border-xan-border bg-xan-card hover:border-xan-crimson/40 hover:bg-xan-card-hover"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-foreground">{opt.label}</span>
                        {duration === opt.id && <Check className="h-3.5 w-3.5 text-xan-crimson" />}
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center justify-between mt-7 pt-5 border-t border-xan-border">
            <button
              type="button"
              onClick={() => (step === 0 ? onSkip() : setStep(0))}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {step === 0 ? (
                <>Skip</>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => (isLastStep ? handleComplete() : setStep(1))}
              disabled={!canAdvance}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white px-6 h-10 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-[0_8px_30px_rgba(233,69,96,0.35)] transition-all"
            >
              {isLastStep ? (
                <>
                  <Check className="h-4 w-4" />
                  Done
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Your answers stay in this browser only — never sent anywhere.
          </p>
        </div>
      </div>
    </div>
  );
}
