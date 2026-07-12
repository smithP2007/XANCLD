/**
 * vibes.ts — shared mood/vibe inference from genres + tags.
 *
 * Per the redesign plan critique (#7): both `getVibeLabel` (AnimeDetail) and
 * future mood shelves (Home) need to map genre/tag combinations to mood
 * labels. They should share ONE module or they'll diverge within a month.
 *
 * This module is pure TypeScript — no React, no localStorage.
 *
 * EXPANDED: 28 vibe rules (was 8) so different anime get distinct, expressive
 * labels instead of everything collapsing to "High-energy action" or
 * "Epic adventure". Each rule has a curated label + emoji + genre/tag
 * matchers. Multiple rules can match; the highest-scoring one wins.
 */

export type Vibe =
  // Cozy / warm
  | "cozy-slow-burn"
  | "heartwarming-slice-of-life"
  | "healing-wholesome"
  | "childhood-nostalgia"
  // Action / energy
  | "high-energy-action"
  | "explosive-shounen"
  | "mecha-warfare"
  | "martial-arts-epic"
  // Mystery / thriller
  | "mind-bending-mystery"
  | "supernatural-thriller"
  | "detective-noir"
  | "survival-horror"
  // Romance
  | "sweet-romance"
  | "bittersweet-romance"
  | "will-they-wont-they"
  | "forbidden-romance"
  // Dark / serious
  | "dark-psychological"
  | "tragic-drama"
  | "grimdark-fantasy"
  | "post-apocalyptic"
  // Comedy
  | "laugh-out-loud"
  | "absurd-parody"
  | "wholesome-comedy"
  // Adventure / fantasy
  | "epic-adventure"
  | "isekai-fantasy"
  | "magical-world"
  // Sci-fi / tech
  | "cyberpunk-future"
  | "space-opera"
  | "time-bending-sci-fi"
  // Music / arts
  | "musical-passion"
  | "creative-pursuits"
  // Sports / competition
  | "sports-rivalry"
  | "underdog-story";

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
  // ─── Cozy / warm ───────────────────────────────────────────────
  {
    vibe: "healing-wholesome",
    label: "Healing & wholesome",
    emoji: "🌿",
    genres: ["Slice of Life"],
    tags: ["Iyashikei", "Healing", "Cute Girls Doing Cute Things", "CGDCT"],
    minMatches: 1,
  },
  {
    vibe: "cozy-slow-burn",
    label: "Cozy slow burn",
    emoji: "🍵",
    genres: ["Slice of Life", "Romance"],
    tags: ["Iyashikei", "Healing", "Female Protagonist", "Workplace", "Restaurant"],
    minMatches: 2,
  },
  {
    vibe: "heartwarming-slice-of-life",
    label: "Heartwarming slice of life",
    emoji: "🌸",
    genres: ["Slice of Life"],
    tags: ["Family", "Friendship", "School", "Coming of Age", "Pets"],
    minMatches: 1,
  },
  {
    vibe: "childhood-nostalgia",
    label: "Childhood nostalgia",
    emoji: "🪁",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Childcare", "Kids", "Nostalgia", "Family Friendly"],
    minMatches: 1,
  },

  // ─── Action / energy ───────────────────────────────────────────
  {
    vibe: "explosive-shounen",
    label: "Explosive shounen battles",
    emoji: "💥",
    genres: ["Action", "Adventure", "Shounen"],
    tags: ["Shounen", "Battle", "Super Power", "Power Suit", "Fighting", "Swordplay"],
    minMatches: 2,
  },
  {
    vibe: "high-energy-action",
    label: "High-energy action",
    emoji: "🔥",
    genres: ["Action"],
    tags: ["Battle", "Martial Arts", "Super Power", "Gunfights", "Assassins", "Ninja"],
    minMatches: 1,
  },
  {
    vibe: "mecha-warfare",
    label: "Mecha warfare",
    emoji: "🤖",
    genres: ["Action", "Mecha", "Sci-Fi"],
    tags: ["Mecha", "Robots", "Military", "Real Robot", "Super Robot"],
    minMatches: 1,
  },
  {
    vibe: "martial-arts-epic",
    label: "Martial arts epic",
    emoji: "🥋",
    genres: ["Action", "Adventure", "Martial Arts"],
    tags: ["Martial Arts", "Fighting", "Training", "Tournament"],
    minMatches: 1,
  },

  // ─── Mystery / thriller ────────────────────────────────────────
  {
    vibe: "detective-noir",
    label: "Detective noir",
    emoji: "🕵️",
    genres: ["Mystery", "Thriller"],
    tags: ["Detective", "Police", "Investigation", "Crime", "Noir"],
    minMatches: 1,
  },
  {
    vibe: "mind-bending-mystery",
    label: "Mind-bending mystery",
    emoji: "🔍",
    genres: ["Mystery", "Psychological", "Thriller"],
    tags: ["Time Travel", "Mind Games", "Conspiracy", "Memory Manipulation", "Dreams"],
    minMatches: 1,
  },
  {
    vibe: "supernatural-thriller",
    label: "Supernatural thriller",
    emoji: "👁️",
    genres: ["Supernatural", "Thriller", "Horror"],
    tags: ["Ghosts", "Demons", "Vampires", "Zombies", "Curses", "Occult"],
    minMatches: 1,
  },
  {
    vibe: "survival-horror",
    label: "Survival horror",
    emoji: "🔪",
    genres: ["Horror", "Thriller", "Action"],
    tags: ["Survival", "Gore", "Zombies", "Apocalypse", "Slasher", "Body Horror"],
    minMatches: 1,
  },

  // ─── Romance ───────────────────────────────────────────────────
  {
    vibe: "sweet-romance",
    label: "Sweet romance",
    emoji: "💗",
    genres: ["Romance"],
    tags: ["Romance", "Love Triangle", "Coming of Age", "School"],
    minMatches: 1,
  },
  {
    vibe: "bittersweet-romance",
    label: "Bittersweet romance",
    emoji: "🍂",
    genres: ["Romance", "Drama"],
    tags: ["Tragedy", "Lost Love", "Separation", "Illness", "Memory"],
    minMatches: 1,
  },
  {
    vibe: "will-they-wont-they",
    label: "Will-they-won't-they",
    emoji: "💭",
    genres: ["Romance", "Comedy"],
    tags: ["Romance", "Love Triangle", "School", "Workplace", "Tsundere"],
    minMatches: 2,
  },
  {
    vibe: "forbidden-romance",
    label: "Forbidden romance",
    emoji: "🌙",
    genres: ["Romance", "Drama"],
    tags: ["Forbidden Love", "Age Gap", "Taboo", "Secret Relationship", "Affair"],
    minMatches: 1,
  },

  // ─── Dark / serious ────────────────────────────────────────────
  {
    vibe: "dark-psychological",
    label: "Dark psychological",
    emoji: "🌑",
    genres: ["Psychological", "Horror", "Drama"],
    tags: ["Psychological", "Gore", "Survival", "Dark", "Mind Games", "Insanity"],
    minMatches: 1,
  },
  {
    vibe: "tragic-drama",
    label: "Tragic drama",
    emoji: "💧",
    genres: ["Drama"],
    tags: ["Tragedy", "Illness", "Loss", "War", "Suffering", "Tearjerker"],
    minMatches: 1,
  },
  {
    vibe: "grimdark-fantasy",
    label: "Grimdark fantasy",
    emoji: "⚔️",
    genres: ["Fantasy", "Action", "Adventure"],
    tags: ["Dark Fantasy", "Gore", "War", "Revenge", "Curses", "Demons"],
    minMatches: 2,
  },
  {
    vibe: "post-apocalyptic",
    label: "Post-apocalyptic",
    emoji: "☢️",
    genres: ["Action", "Adventure", "Sci-Fi", "Drama"],
    tags: ["Apocalypse", "Post-Apocalyptic", "Survival", "Wasteland", "Nuclear"],
    minMatches: 1,
  },

  // ─── Comedy ────────────────────────────────────────────────────
  {
    vibe: "absurd-parody",
    label: "Absurd parody",
    emoji: "🤪",
    genres: ["Comedy"],
    tags: ["Parody", "Gag Humor", "Slapstick", "Satire", "Meta", "Absurd"],
    minMatches: 1,
  },
  {
    vibe: "laugh-out-loud",
    label: "Laugh-out-loud",
    emoji: "😂",
    genres: ["Comedy"],
    tags: ["Comedy", "Slapstick", "Gag Humor", "Misunderstanding", "Ensemble Cast"],
    minMatches: 1,
  },
  {
    vibe: "wholesome-comedy",
    label: "Wholesome comedy",
    emoji: "😊",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Comedy", "School", "Friendship", "Family", "Workplace", "Cute"],
    minMatches: 2,
  },

  // ─── Adventure / fantasy ───────────────────────────────────────
  {
    vibe: "isekai-fantasy",
    label: "Isekai fantasy",
    emoji: "🌀",
    genres: ["Adventure", "Fantasy", "Action"],
    tags: ["Isekai", "Reincarnation", "Transported", "Another World", "Fantasy World"],
    minMatches: 1,
  },
  {
    vibe: "epic-adventure",
    label: "Epic adventure",
    emoji: "🗺️",
    genres: ["Adventure", "Fantasy"],
    tags: ["Journey", "Quest", "Exploration", "Treasure Hunt", "Pirates"],
    minMatches: 1,
  },
  {
    vibe: "magical-world",
    label: "Magical world",
    emoji: "✨",
    genres: ["Fantasy", "Supernatural"],
    tags: ["Magic", "Wizards", "Witches", "Magical Girl", "Fairy Tale", "Mythology"],
    minMatches: 1,
  },

  // ─── Sci-fi / tech ─────────────────────────────────────────────
  {
    vibe: "cyberpunk-future",
    label: "Cyberpunk future",
    emoji: "🌃",
    genres: ["Sci-Fi", "Action"],
    tags: ["Cyberpunk", "AI", "Hacking", "Dystopia", "Megacorp", "Net"],
    minMatches: 1,
  },
  {
    vibe: "space-opera",
    label: "Space opera",
    emoji: "🚀",
    genres: ["Sci-Fi", "Adventure", "Action"],
    tags: ["Space", "Spaceship", "Aliens", "Galactic", "Space Opera", "Interstellar"],
    minMatches: 1,
  },
  {
    vibe: "time-bending-sci-fi",
    label: "Time-bending sci-fi",
    emoji: "⏳",
    genres: ["Sci-Fi", "Mystery"],
    tags: ["Time Travel", "Time Loop", "Alternate Timeline", "Butterfly Effect", "Paradox"],
    minMatches: 1,
  },

  // ─── Music / arts ──────────────────────────────────────────────
  {
    vibe: "musical-passion",
    label: "Musical passion",
    emoji: "🎵",
    genres: ["Music"],
    tags: ["Music", "Band", "Idol", "Singing", "Instrument", "Concert", "Rock"],
    minMatches: 1,
  },
  {
    vibe: "creative-pursuits",
    label: "Creative pursuits",
    emoji: "🎨",
    genres: ["Slice of Life", "Drama"],
    tags: ["Art", "Painting", "Writing", "Photography", "Film", "Acting", "Manga"],
    minMatches: 1,
  },

  // ─── Sports / competition ──────────────────────────────────────
  {
    vibe: "sports-rivalry",
    label: "Sports rivalry",
    emoji: "🏆",
    genres: ["Sports"],
    tags: ["Basketball", "Soccer", "Baseball", "Volleyball", "Tennis", "Swimming", "Boxing"],
    minMatches: 1,
  },
  {
    vibe: "underdog-story",
    label: "Underdog story",
    emoji: "💪",
    genres: ["Sports", "Action", "Adventure"],
    tags: ["Underdog", "Training", "Tournament", "Rivalry", "Hard Work", "Genius"],
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
    case "cozy-slow-burn":
    case "heartwarming-slice-of-life":
    case "healing-wholesome":
    case "childhood-nostalgia":
      return "cozy";
    case "high-energy-action":
    case "explosive-shounen":
    case "mecha-warfare":
    case "martial-arts-epic":
      return "action";
    case "mind-bending-mystery":
    case "supernatural-thriller":
    case "detective-noir":
    case "survival-horror":
      return "mystery";
    case "sweet-romance":
    case "bittersweet-romance":
    case "will-they-wont-they":
    case "forbidden-romance":
      return "romance";
    case "dark-psychological":
    case "tragic-drama":
    case "grimdark-fantasy":
    case "post-apocalyptic":
      return "dark";
    case "laugh-out-loud":
    case "absurd-parody":
    case "wholesome-comedy":
      return "funny";
    // Default fallback for vibes that don't map cleanly to a mood
    case "epic-adventure":
    case "isekai-fantasy":
    case "magical-world":
    case "cyberpunk-future":
    case "space-opera":
    case "time-bending-sci-fi":
    case "musical-passion":
    case "creative-pursuits":
    case "sports-rivalry":
    case "underdog-story":
      return "action";
  }
}
