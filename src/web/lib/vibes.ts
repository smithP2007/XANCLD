/**
 * vibes.ts — shared mood/vibe inference from genres + tags.
 *
 * Per the redesign plan critique (#7): both `getVibeLabel` (AnimeDetail) and
 * future mood shelves (Home) need to map genre/tag combinations to mood
 * labels. They should share ONE module or they'll diverge within a month.
 *
 * This module is pure TypeScript — no React, no localStorage.
 */

export type Vibe =
  | "cozy-slow-burn"
  | "high-energy-action"
  | "mind-bending-mystery"
  | "sweet-romance"
  | "dark-psychological"
  | "laugh-out-loud"
  | "epic-adventure"
  | "supernatural-thriller";

interface VibeRule {
  vibe: Vibe;
  label: string;
  emoji: string;
  /** Genres that contribute to this vibe (any match counts). */
  genres: string[];
  /** Tags that contribute (any match counts). Tags are more discriminating. */
  tags?: string[];
  /** Minimum number of genre/tag matches required. Default 1. */
  minMatches?: number;
}

const RULES: VibeRule[] = [
  {
    vibe: "cozy-slow-burn",
    label: "Cozy slow burn",
    emoji: "🍵",
    genres: ["Slice of Life", "Romance"],
    tags: ["Iyashikei", "Healing", "Female Protagonist", "Workplace"],
    minMatches: 2,
  },
  {
    vibe: "high-energy-action",
    label: "High-energy action",
    emoji: "🔥",
    genres: ["Action", "Shounen", "Adventure"],
    tags: ["Battle", "Martial Arts", "Super Power", "Shounen"],
    minMatches: 2,
  },
  {
    vibe: "mind-bending-mystery",
    label: "Mind-bending mystery",
    emoji: "🔍",
    genres: ["Mystery", "Psychological", "Thriller"],
    tags: ["Time Travel", "Mind Games", "Detective", "Conspiracy"],
    minMatches: 1,
  },
  {
    vibe: "sweet-romance",
    label: "Sweet romance",
    emoji: "💗",
    genres: ["Romance"],
    tags: ["Romance", "Love Triangle", "Coming of Age"],
    minMatches: 1,
  },
  {
    vibe: "dark-psychological",
    label: "Dark psychological",
    emoji: "🌑",
    genres: ["Horror", "Psychological", "Drama"],
    tags: ["Gore", "Survival", "Tragedy", "Dark"],
    minMatches: 2,
  },
  {
    vibe: "laugh-out-loud",
    label: "Laugh-out-loud",
    emoji: "😂",
    genres: ["Comedy"],
    tags: ["Parody", "Gag Humor", "Slapstick", "Comedy"],
    minMatches: 1,
  },
  {
    vibe: "epic-adventure",
    label: "Epic adventure",
    emoji: "🗺️",
    genres: ["Adventure", "Fantasy"],
    tags: ["Isekai", "Journey", "Quest", "Fantasy World"],
    minMatches: 2,
  },
  {
    vibe: "supernatural-thriller",
    label: "Supernatural thriller",
    emoji: "👁️",
    genres: ["Supernatural", "Thriller", "Horror"],
    tags: ["Ghosts", "Demons", "Vampires", "Zombies"],
    minMatches: 1,
  },
];

/**
 * Infer the strongest vibe for an anime from its genres + tags.
 * Returns null if no rule matches (the anime is generic or unknown).
 *
 * Tags are weighted 2x heavier than genres per the critique: tags are far
 * more discriminating in anime (most Shounen share Action/Adventure/Comedy,
 * but tags like "Iyashikei" or "Time Travel" are specific).
 */
export function getVibeLabel(
  genres: string[] | undefined | null,
  tags?: string[] | null,
): { vibe: Vibe; label: string; emoji: string } | null {
  if (!genres || genres.length === 0) return null;
  const tagArr = tags ?? [];

  let best: { vibe: Vibe; label: string; emoji: string; score: number } | null = null;

  for (const rule of RULES) {
    const genreMatches = rule.genres.filter((g) => genres.includes(g)).length;
    const tagMatches = rule.tags
      ? rule.tags.filter((t) => tagArr.some((u) => u.toLowerCase() === t.toLowerCase())).length
      : 0;
    const totalScore = genreMatches + tagMatches * 2;
    const minMatches = rule.minMatches ?? 1;
    if (totalScore < minMatches) continue;
    if (!best || totalScore > best.score) {
      best = { vibe: rule.vibe, label: rule.label, emoji: rule.emoji, score: totalScore };
    }
  }

  return best ? { vibe: best.vibe, label: best.label, emoji: best.emoji } : null;
}

/** Map a Vibe to the onboarding MoodPreference used by recommend.ts. */
export function vibeToMood(vibe: Vibe): "action" | "cozy" | "funny" | "romance" | "mystery" | "dark" {
  switch (vibe) {
    case "cozy-slow-burn": return "cozy";
    case "high-energy-action": return "action";
    case "epic-adventure": return "action";
    case "mind-bending-mystery": return "mystery";
    case "supernatural-thriller": return "mystery";
    case "sweet-romance": return "romance";
    case "dark-psychological": return "dark";
    case "laugh-out-loud": return "funny";
  }
}
