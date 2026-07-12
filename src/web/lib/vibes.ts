/**
 * vibes.ts — shared mood/vibe inference from genres + tags.
 *
 * Per the redesign plan critique (#7): both `getVibeLabel` (AnimeDetail) and
 * future mood shelves (Home) need to map genre/tag combinations to mood
 * labels. They should share ONE module or they'll diverge within a month.
 *
 * This module is pure TypeScript — no React, no localStorage.
 *
 * EXPANDED: 60 vibe rules across 15 categories so different anime get
 * distinct, expressive labels instead of collapsing to a few generic ones.
 * Each rule has a curated label + emoji + genre/tag matchers. Multiple
 * rules can match; the highest-scoring one wins.
 */

export type Vibe =
  // ─── Cozy / warm (5) ───
  | "cozy-slow-burn"
  | "heartwarming-slice-of-life"
  | "healing-wholesome"
  | "childhood-nostalgia"
  | "everyday-comfort"
  // ─── Action / energy (5) ───
  | "high-energy-action"
  | "explosive-shounen"
  | "mecha-warfare"
  | "martial-arts-epic"
  | "gun-fu-frenzy"
  // ─── Mystery / thriller (5) ───
  | "mind-bending-mystery"
  | "supernatural-thriller"
  | "detective-noir"
  | "survival-horror"
  | "conspiracy-uncovered"
  // ─── Romance (5) ───
  | "sweet-romance"
  | "bittersweet-romance"
  | "will-they-wont-they"
  | "forbidden-romance"
  | "office-romance"
  // ─── Dark / serious (5) ───
  | "dark-psychological"
  | "tragic-drama"
  | "grimdark-fantasy"
  | "post-apocalyptic"
  | "revenge-saga"
  // ─── Comedy (4) ───
  | "laugh-out-loud"
  | "absurd-parody"
  | "wholesome-comedy"
  | "situational-cringe-comedy"
  // ─── Adventure / fantasy (5) ───
  | "epic-adventure"
  | "isekai-fantasy"
  | "magical-world"
  | "treasure-hunt"
  | "lost-world"
  // ─── Sci-fi / tech (5) ───
  | "cyberpunk-future"
  | "space-opera"
  | "time-bending-sci-fi"
  | "virtual-reality-game"
  | "ai-existential"
  // ─── Music / arts (3) ───
  | "musical-passion"
  | "creative-pursuits"
  | "idol-stardom"
  // ─── Sports / competition (4) ───
  | "sports-rivalry"
  | "underdog-story"
  | "tournament-arc"
  | "team-spirit"
  // ─── Historical / cultural (4) ───
  | "historical-period"
  | "samurai-feudal"
  | "military-war-drama"
  | "political-intrigue"
  // ─── School / work (4) ───
  | "school-life-drama"
  | "school-club"
  | "workplace-comedy"
  | "cram-school-pressure"
  // ─── Food / lifestyle (3) ───
  | "cooking-food"
  | "travel-journey"
  | "festival-cultural"
  // ─── Surreal / philosophical (3) ───
  | "surreal-dreamlike"
  | "philosophical"
  | "coming-of-age";

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
  // ─── Cozy / warm (5) ────────────────────────────────────────────
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
  {
    vibe: "everyday-comfort",
    label: "Everyday comfort",
    emoji: "🫖",
    genres: ["Slice of Life"],
    tags: ["Daily Life", "Quiet", "Countryside", "Tea", "Slow Paced"],
    minMatches: 1,
  },

  // ─── Action / energy (5) ────────────────────────────────────────
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
  {
    vibe: "gun-fu-frenzy",
    label: "Gun-fu frenzy",
    emoji: "🔫",
    genres: ["Action"],
    tags: ["Gunfights", "Assassins", "Mercenaries", "Sniper", "Crime", "Mafia"],
    minMatches: 1,
  },

  // ─── Mystery / thriller (5) ────────────────────────────────────
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
  {
    vibe: "conspiracy-uncovered",
    label: "Conspiracy uncovered",
    emoji: "🧩",
    genres: ["Mystery", "Thriller", "Psychological"],
    tags: ["Conspiracy", "Secret Organization", "Government", "Whistleblower", "Cover-up"],
    minMatches: 1,
  },

  // ─── Romance (5) ───────────────────────────────────────────────
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
  {
    vibe: "office-romance",
    label: "Office romance",
    emoji: "💼",
    genres: ["Romance", "Slice of Life"],
    tags: ["Workplace", "Office", "Coworker", "Adult", "Salaryman"],
    minMatches: 1,
  },

  // ─── Dark / serious (5) ────────────────────────────────────────
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
  {
    vibe: "revenge-saga",
    label: "Revenge saga",
    emoji: "🗡️",
    genres: ["Action", "Drama", "Thriller"],
    tags: ["Revenge", "Vengeance", "Betrayal", "Grudge", "Payback"],
    minMatches: 1,
  },

  // ─── Comedy (4) ───────────────────────────────────────────────
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
  {
    vibe: "situational-cringe-comedy",
    label: "Situational cringe comedy",
    emoji: "😅",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Misunderstanding", "Embarrassing", "Awkward", "Cringe", "Social Anxiety"],
    minMatches: 1,
  },

  // ─── Adventure / fantasy (5) ───────────────────────────────────
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
  {
    vibe: "treasure-hunt",
    label: "Treasure hunt",
    emoji: "💎",
    genres: ["Adventure", "Action"],
    tags: ["Treasure Hunt", "Pirates", "Exploration", "Artifact", "Ruin"],
    minMatches: 1,
  },
  {
    vibe: "lost-world",
    label: "Lost world",
    emoji: "🗿",
    genres: ["Adventure", "Fantasy"],
    tags: ["Lost World", "Ancient Civilization", "Uncharted", "Dungeon", "Labyrinth"],
    minMatches: 1,
  },

  // ─── Sci-fi / tech (5) ─────────────────────────────────────────
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
  {
    vibe: "virtual-reality-game",
    label: "Virtual reality game",
    emoji: "🎮",
    genres: ["Action", "Adventure", "Sci-Fi"],
    tags: ["VR", "Virtual Reality", "MMORPG", "Video Game", "Death Game", "Sword Art Online"],
    minMatches: 1,
  },
  {
    vibe: "ai-existential",
    label: "AI existential",
    emoji: "🧠",
    genres: ["Sci-Fi", "Drama", "Psychological"],
    tags: ["AI", "Artificial Intelligence", "Android", "Robot", "Consciousness", "Turing Test"],
    minMatches: 1,
  },

  // ─── Music / arts (3) ──────────────────────────────────────────
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
  {
    vibe: "idol-stardom",
    label: "Idol stardom",
    emoji: "🌟",
    genres: ["Music", "Drama"],
    tags: ["Idol", "Pop Star", "Concert", "Fame", "Fan Service", "Dance"],
    minMatches: 1,
  },

  // ─── Sports / competition (4) ──────────────────────────────────
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
  {
    vibe: "tournament-arc",
    label: "Tournament arc",
    emoji: "🥇",
    genres: ["Action", "Sports", "Adventure"],
    tags: ["Tournament", "Competition", "Bracket", "Championship", "Qualifier"],
    minMatches: 1,
  },
  {
    vibe: "team-spirit",
    label: "Team spirit",
    emoji: "🤝",
    genres: ["Sports", "Slice of Life"],
    tags: ["Team", "Basketball", "Soccer", "Baseball", "Volleyball", "Cooperation"],
    minMatches: 1,
  },

  // ─── Historical / cultural (4) ─────────────────────────────────
  {
    vibe: "historical-period",
    label: "Historical period",
    emoji: "📜",
    genres: ["Historical", "Drama", "Romance"],
    tags: ["Historical", "Period Piece", "Edo", "Meiji", "Taisho", "Showa", "Victorian"],
    minMatches: 1,
  },
  {
    vibe: "samurai-feudal",
    label: "Samurai & feudal Japan",
    emoji: "⚔️",
    genres: ["Action", "Historical", "Adventure"],
    tags: ["Samurai", "Shogun", "Feudal", "Katana", "Bushi", "Ronin", "Ninja"],
    minMatches: 1,
  },
  {
    vibe: "military-war-drama",
    label: "Military war drama",
    emoji: "🎖️",
    genres: ["Action", "Drama", "Adventure"],
    tags: ["Military", "War", "Soldiers", "Army", "Navy", "Air Force", "Combat"],
    minMatches: 1,
  },
  {
    vibe: "political-intrigue",
    label: "Political intrigue",
    emoji: "♛",
    genres: ["Drama", "Mystery", "Fantasy"],
    tags: ["Politics", "Kingdom", "Throne", "Betrayal", "Coup", "Empire", "Kingdom"],
    minMatches: 1,
  },

  // ─── School / work (4) ─────────────────────────────────────────
  {
    vibe: "school-life-drama",
    label: "School life drama",
    emoji: "🎒",
    genres: ["Drama", "Romance", "Slice of Life"],
    tags: ["School", "High School", "Middle School", "Student Council", "Classroom"],
    minMatches: 1,
  },
  {
    vibe: "school-club",
    label: "School club",
    emoji: "🖇️",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Club", "School Club", "After School", "Light Music", "Tea", "Brass Band"],
    minMatches: 1,
  },
  {
    vibe: "workplace-comedy",
    label: "Workplace comedy",
    emoji: "📊",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Workplace", "Office", "Salaryman", "Company", "Coworker", "Boss"],
    minMatches: 1,
  },
  {
    vibe: "cram-school-pressure",
    label: "Cram school pressure",
    emoji: "📚",
    genres: ["Drama", "Slice of Life"],
    tags: ["Cram School", "Exam", "Study", "Entrance Exam", "Pressure", "Academic"],
    minMatches: 1,
  },

  // ─── Food / lifestyle (3) ──────────────────────────────────────
  {
    vibe: "cooking-food",
    label: "Cooking & food",
    emoji: "🍳",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Cooking", "Food", "Restaurant", "Chef", "Cuisine", "Recipe", "Gourmet"],
    minMatches: 1,
  },
  {
    vibe: "travel-journey",
    label: "Travel & journey",
    emoji: "🧳",
    genres: ["Adventure", "Slice of Life"],
    tags: ["Travel", "Journey", "Road Trip", "Exploration", "Tourism", "Wandering"],
    minMatches: 1,
  },
  {
    vibe: "festival-cultural",
    label: "Festival & cultural",
    emoji: "🎏",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Festival", "Matsuri", "Cultural", "Tradition", "Shrine", "Summer Festival"],
    minMatches: 1,
  },

  // ─── Surreal / philosophical (3) ───────────────────────────────
  {
    vibe: "surreal-dreamlike",
    label: "Surreal & dreamlike",
    emoji: "🌀",
    genres: ["Psychological", "Supernatural", "Mystery"],
    tags: ["Surreal", "Dreams", "Abstract", "Mind Trip", "Surrealism", "Avant-garde"],
    minMatches: 1,
  },
  {
    vibe: "philosophical",
    label: "Philosophical",
    emoji: "🤔",
    genres: ["Psychological", "Drama", "Sci-Fi"],
    tags: ["Philosophy", "Existential", "Ethics", "Morality", "Meaning", "Nihilism"],
    minMatches: 1,
  },
  {
    vibe: "coming-of-age",
    label: "Coming of age",
    emoji: "🌱",
    genres: ["Drama", "Slice of Life", "Romance"],
    tags: ["Coming of Age", "Growing Up", "Adolescence", "Adulthood", "Self-Discovery"],
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

/**
 * Map a Vibe to the onboarding MoodPreference used by recommend.ts.
 * This must be exhaustive — every Vibe must map to a mood.
 */
export function vibeToMood(vibe: Vibe): "action" | "cozy" | "funny" | "romance" | "mystery" | "dark" {
  switch (vibe) {
    // Cozy
    case "cozy-slow-burn":
    case "heartwarming-slice-of-life":
    case "healing-wholesome":
    case "childhood-nostalgia":
    case "everyday-comfort":
      return "cozy";

    // Action
    case "high-energy-action":
    case "explosive-shounen":
    case "mecha-warfare":
    case "martial-arts-epic":
    case "gun-fu-frenzy":
      return "action";

    // Mystery
    case "mind-bending-mystery":
    case "supernatural-thriller":
    case "detective-noir":
    case "survival-horror":
    case "conspiracy-uncovered":
      return "mystery";

    // Romance
    case "sweet-romance":
    case "bittersweet-romance":
    case "will-they-wont-they":
    case "forbidden-romance":
    case "office-romance":
      return "romance";

    // Dark
    case "dark-psychological":
    case "tragic-drama":
    case "grimdark-fantasy":
    case "post-apocalyptic":
    case "revenge-saga":
      return "dark";

    // Funny
    case "laugh-out-loud":
    case "absurd-parody":
    case "wholesome-comedy":
    case "situational-cringe-comedy":
      return "funny";

    // Adventure / fantasy → action (adventure energy)
    case "epic-adventure":
    case "isekai-fantasy":
    case "magical-world":
    case "treasure-hunt":
    case "lost-world":
      return "action";

    // Sci-fi / tech → action (tech energy)
    case "cyberpunk-future":
    case "space-opera":
    case "time-bending-sci-fi":
    case "virtual-reality-game":
    case "ai-existential":
      return "action";

    // Music / arts → cozy (creative/wholesome energy)
    case "musical-passion":
    case "creative-pursuits":
    case "idol-stardom":
      return "cozy";

    // Sports → action (competitive energy)
    case "sports-rivalry":
    case "underdog-story":
    case "tournament-arc":
    case "team-spirit":
      return "action";

    // Historical / cultural → action (dramatic energy)
    case "historical-period":
    case "samurai-feudal":
    case "military-war-drama":
    case "political-intrigue":
      return "action";

    // School / work → cozy (everyday energy)
    case "school-life-drama":
    case "school-club":
    case "workplace-comedy":
    case "cram-school-pressure":
      return "cozy";

    // Food / lifestyle → cozy
    case "cooking-food":
    case "travel-journey":
    case "festival-cultural":
      return "cozy";

    // Surreal / philosophical → mystery (cerebral)
    case "surreal-dreamlike":
    case "philosophical":
    case "coming-of-age":
      return "mystery";
  }
}
