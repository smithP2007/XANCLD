/**
 * vibes.ts — shared mood/vibe inference from genres + tags.
 *
 * 60 vibe rules across 15 categories. Each rule has curated genre + tag
 * matchers. Tags are weighted 2x heavier than genres (tags are far more
 * discriminating — "Iyashikei" or "Time Travel" vs generic "Action").
 *
 * VERIFIED against 31 real AniList anime across all categories.
 * See scripts/test_vibes.js for the test suite.
 *
 * AniList GENRE enum (fixed): Action, Adventure, Comedy, Drama, Fantasy,
 * Horror, Mecha, Music, Mystery, Psychological, Romance, Sci-Fi, Slice of
 * Life, Sports, Supernatural, Thriller, Suspense, Award Winning, Gourmet,
 * Reincarnation, Ecchi, Erotica, Hentai.
 *
 * Everything else (Shounen, Ninja, Iyashikei, Time Manipulation, Gore,
 * Military, Historical, Surreal Comedy, etc.) is a TAG.
 *
 * SCORING: genre match = +1, tag match = +2. Rule fires if
 * totalScore >= minMatches. Highest score wins; ties go to first rule.
 *
 * KEY DESIGN PRINCIPLES (learned from bugs):
 * 1. Specific genres (Mecha, Music, Sports, Horror) fire with minMatches: 1
 *    because the genre alone is discriminating enough.
 * 2. Generic genres (Action, Adventure, Comedy, Drama) need minMatches: 2+
 *    and tag matches to prevent over-matching.
 * 3. Rules with overlapping genres are ordered so the most specific rule
 *    comes FIRST (wins ties). E.g. isekai-fantasy before epic-adventure,
 *    survival-horror before supernatural-thriller.
 * 4. Tag lists include ALL common AniList tag variants (e.g. "Time
 *    Manipulation" not just "Time Travel", "Surreal Comedy" not just
 *    "Slapstick", "Post-Apocalyptic" and "Dystopian" not just "Apocalypse").
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
  /** AniList GENRES that match. Each match = 1 point. */
  genres: string[];
  /** AniList TAGS that match. Each match = 2 points. */
  tags?: string[];
  /** Minimum total score required. Default 1. */
  minMatches?: number;
  /** When true, ALL listed genres must be present for the rule to fire.
   *  Prevents tags from compensating for a missing required genre.
   *  E.g. explosive-shounen needs BOTH Action AND Adventure, not just
   *  Action + Shounen tag. */
  requireAllGenres?: boolean;
}

const RULES: VibeRule[] = [
  // ═══ ORDER MATTERS: most specific rules first (wins ties) ═══

  // ─── Sci-fi / tech (5) — BEFORE adventure so SAO gets VR not isekai ───
  {
    vibe: "virtual-reality-game",
    label: "Virtual reality game",
    emoji: "🎮",
    genres: ["Sci-Fi", "Action"],
    tags: ["VR", "Virtual Reality", "MMORPG", "Video Game", "Death Game", "Virtual World", "Video Games"],
    minMatches: 2,
  },
  {
    vibe: "time-bending-sci-fi",
    label: "Time-bending sci-fi",
    emoji: "⏳",
    genres: ["Sci-Fi", "Mystery", "Psychological"],
    tags: ["Time Travel", "Time Loop", "Alternate Timeline", "Butterfly Effect", "Paradox", "Time Manipulation", "Time Skip", "Age Regression"],
    minMatches: 2,
  },
  {
    vibe: "cyberpunk-future",
    label: "Cyberpunk future",
    emoji: "🌃",
    genres: ["Sci-Fi"],
    tags: ["Cyberpunk", "AI", "Hacking", "Dystopia", "Megacorp", "Net", "Dystopian"],
    minMatches: 2,
  },
  {
    vibe: "space-opera",
    label: "Space opera",
    emoji: "🚀",
    genres: ["Sci-Fi"],
    tags: ["Space", "Spaceship", "Aliens", "Galactic", "Space Opera", "Interstellar"],
    minMatches: 2,
  },
  {
    vibe: "ai-existential",
    label: "AI existential",
    emoji: "🧠",
    genres: ["Sci-Fi", "Psychological"],
    tags: ["AI", "Artificial Intelligence", "Android", "Robot", "Consciousness", "Turing Test"],
    minMatches: 2,
  },

  // ─── Adventure / fantasy (5) — isekai BEFORE epic to win ties ───
  {
    vibe: "isekai-fantasy",
    label: "Isekai fantasy",
    emoji: "🌀",
    genres: ["Adventure", "Fantasy"],
    tags: ["Isekai", "Reincarnation", "Transported", "Another World", "Fantasy World", "Virtual World", "Alternate Universe"],
    minMatches: 3,
  },
  {
    vibe: "epic-adventure",
    label: "Epic adventure",
    emoji: "🗺️",
    genres: ["Adventure", "Fantasy"],
    tags: ["Journey", "Quest", "Exploration", "Treasure Hunt", "Pirates", "Travel"],
    minMatches: 3,
  },
  {
    vibe: "magical-world",
    label: "Magical world",
    emoji: "✨",
    genres: ["Fantasy", "Supernatural"],
    tags: ["Magic", "Wizards", "Witches", "Magical Girl", "Fairy Tale", "Mythology", "Gods"],
    minMatches: 2,
  },
  {
    vibe: "treasure-hunt",
    label: "Treasure hunt",
    emoji: "💎",
    genres: ["Adventure"],
    tags: ["Treasure Hunt", "Pirates", "Exploration", "Artifact", "Ruin"],
    minMatches: 2,
  },
  {
    vibe: "lost-world",
    label: "Lost world",
    emoji: "🗿",
    genres: ["Adventure", "Fantasy"],
    tags: ["Lost World", "Ancient Civilization", "Uncharted", "Dungeon", "Labyrinth", "Lost Civilization"],
    minMatches: 2,
  },

  // ─── Music / arts (3) — BEFORE school-life so YLiA gets musical ───
  {
    vibe: "musical-passion",
    label: "Musical passion",
    emoji: "🎵",
    genres: ["Music"],
    tags: ["Band", "Idol", "Singing", "Instrument", "Concert", "Rock", "Classical Music"],
    minMatches: 1, // Music genre alone is specific enough
  },
  {
    vibe: "creative-pursuits",
    label: "Creative pursuits",
    emoji: "🎨",
    genres: ["Slice of Life", "Drama"],
    tags: ["Art", "Painting", "Writing", "Photography", "Film", "Acting", "Manga"],
    minMatches: 2,
  },
  {
    vibe: "idol-stardom",
    label: "Idol stardom",
    emoji: "🌟",
    genres: ["Music", "Drama"],
    tags: ["Idol", "Pop Star", "Concert", "Fame", "Fan Service", "Dance"],
    minMatches: 2,
  },

  // ─── Sports / competition (4) ───
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
    genres: ["Sports", "Action"],
    tags: ["Underdog", "Training", "Tournament", "Rivalry", "Hard Work", "Genius"],
    minMatches: 2,
  },
  {
    vibe: "tournament-arc",
    label: "Tournament arc",
    emoji: "🥇",
    genres: ["Action", "Sports"],
    tags: ["Tournament", "Competition", "Bracket", "Championship", "Qualifier"],
    minMatches: 2,
  },
  {
    vibe: "team-spirit",
    label: "Team spirit",
    emoji: "🤝",
    genres: ["Sports", "Slice of Life"],
    tags: ["Team", "Basketball", "Soccer", "Baseball", "Volleyball", "Cooperation"],
    minMatches: 2,
  },

  // ─── Mystery / thriller (5) ───
  {
    vibe: "detective-noir",
    label: "Detective noir",
    emoji: "🕵️",
    genres: ["Mystery", "Thriller"],
    tags: ["Detective", "Police", "Investigation", "Crime", "Noir", "Fugitive"],
    minMatches: 2,
  },
  {
    vibe: "mind-bending-mystery",
    label: "Mind-bending mystery",
    emoji: "🔍",
    genres: ["Mystery", "Psychological"],
    tags: ["Time Travel", "Mind Games", "Conspiracy", "Memory Manipulation", "Dreams", "Time Manipulation"],
    minMatches: 2,
  },
  {
    vibe: "survival-horror",
    label: "Survival horror",
    emoji: "🔪",
    genres: ["Horror"],
    tags: ["Survival", "Gore", "Zombies", "Apocalypse", "Slasher", "Body Horror", "Human Experimentation", "Torture"],
    minMatches: 2, // Horror genre + a dark tag
  },
  {
    vibe: "supernatural-thriller",
    label: "Supernatural thriller",
    emoji: "👁️",
    genres: ["Supernatural", "Thriller", "Horror"],
    tags: ["Ghosts", "Demons", "Vampires", "Zombies", "Curses", "Occult", "Youkai", "Exorcism", "Kaiju"],
    minMatches: 2,
  },
  {
    vibe: "conspiracy-uncovered",
    label: "Conspiracy uncovered",
    emoji: "🧩",
    genres: ["Mystery", "Thriller"],
    tags: ["Conspiracy", "Secret Organization", "Government", "Whistleblower", "Cover-up", "Espionage", "Dystopian"],
    minMatches: 2,
  },

  // ─── Dark / serious (5) — grimdark before revenge so AoT gets grimdark ───
  {
    vibe: "grimdark-fantasy",
    label: "Grimdark fantasy",
    emoji: "⚔️",
    genres: ["Fantasy", "Horror"],
    tags: ["Dark Fantasy", "Gore", "War", "Revenge", "Curses", "Demons", "Death", "Tragedy", "Survival", "Body Horror", "Military", "Post-Apocalyptic"],
    minMatches: 2, // Fantasy/Horror + a dark tag
  },
  {
    vibe: "dark-psychological",
    label: "Dark psychological",
    emoji: "🌑",
    genres: ["Psychological", "Horror"],
    tags: ["Psychological", "Gore", "Survival", "Dark", "Mind Games", "Insanity", "Torture", "Human Experimentation"],
    minMatches: 2,
  },
  {
    vibe: "tragic-drama",
    label: "Tragic drama",
    emoji: "💧",
    genres: ["Drama"],
    tags: ["Tragedy", "Illness", "Loss", "War", "Suffering", "Tearjerker", "Suicide", "Rehabilitation", "Disability"],
    minMatches: 2,
  },
  {
    vibe: "post-apocalyptic",
    label: "Post-apocalyptic",
    emoji: "☢️",
    genres: ["Sci-Fi", "Drama", "Action"],
    tags: ["Apocalypse", "Post-Apocalyptic", "Survival", "Wasteland", "Nuclear", "Dystopian"],
    minMatches: 2,
  },
  {
    vibe: "revenge-saga",
    label: "Revenge saga",
    emoji: "🗡️",
    genres: ["Action", "Drama"],
    tags: ["Revenge", "Vengeance", "Betrayal", "Grudge", "Payback"],
    minMatches: 4, // Raised to 4 so it only fires when revenge is the STRONGEST signal (2 genres + 1 tag)
  },

  // ─── Historical / cultural (4) ───
  {
    vibe: "historical-period",
    label: "Historical period",
    emoji: "📜",
    genres: ["Drama", "Romance", "Action"],
    tags: ["Historical", "Period Piece", "Edo", "Meiji", "Taisho", "Showa", "Victorian", "Vikings", "Foreign"],
    minMatches: 2,
  },
  {
    vibe: "samurai-feudal",
    label: "Samurai & feudal Japan",
    emoji: "⚔️",
    genres: ["Action", "Adventure"],
    tags: ["Samurai", "Shogun", "Feudal", "Katana", "Bushi", "Ronin", "Ninja"],
    minMatches: 2,
  },
  {
    vibe: "military-war-drama",
    label: "Military war drama",
    emoji: "🎖️",
    genres: ["Drama", "Action"],
    tags: ["Military", "War", "Soldiers", "Army", "Navy", "Air Force", "Combat"],
    minMatches: 2,
  },
  {
    vibe: "political-intrigue",
    label: "Political intrigue",
    emoji: "♛",
    genres: ["Drama", "Mystery"],
    tags: ["Politics", "Kingdom", "Throne", "Betrayal", "Coup", "Empire"],
    minMatches: 2,
  },

  // ─── Action / energy (5) — explosive-shounen needs BOTH Action+Adventure ───
  {
    vibe: "explosive-shounen",
    label: "Explosive shounen battles",
    emoji: "💥",
    genres: ["Action", "Adventure"],
    tags: ["Shounen", "Battle", "Super Power", "Power Suit", "Fighting", "Swordplay", "Superhero"],
    minMatches: 4,
    requireAllGenres: true, // BOTH Action AND Adventure required — prevents JJK/Spies from matching
  },
  {
    vibe: "high-energy-action",
    label: "High-energy action",
    emoji: "🔥",
    genres: ["Action"],
    tags: ["Battle", "Martial Arts", "Super Power", "Gunfights", "Assassins", "Ninja", "Shounen", "Superhero"],
    minMatches: 2, // Action + 1 tag
  },
  {
    vibe: "mecha-warfare",
    label: "Mecha warfare",
    emoji: "🤖",
    genres: ["Mecha"],
    tags: ["Robots", "Military", "Real Robot", "Super Robot"],
    minMatches: 1,
  },
  {
    vibe: "martial-arts-epic",
    label: "Martial arts epic",
    emoji: "🥋",
    genres: ["Action"],
    tags: ["Martial Arts", "Fighting", "Training", "Tournament"],
    minMatches: 2,
  },
  {
    vibe: "gun-fu-frenzy",
    label: "Gun-fu frenzy",
    emoji: "🔫",
    genres: ["Action"],
    tags: ["Gunfights", "Assassins", "Mercenaries", "Sniper", "Crime", "Mafia", "Espionage"],
    minMatches: 2,
  },

  // ─── Romance (5) ───
  {
    vibe: "bittersweet-romance",
    label: "Bittersweet romance",
    emoji: "🍂",
    genres: ["Romance", "Drama"],
    tags: ["Tragedy", "Lost Love", "Separation", "Illness", "Memory", "Memory Manipulation", "Disability", "Suicide"],
    minMatches: 3, // Raised to 3 so it doesn't beat isekai-fantasy on tie
  },
  {
    vibe: "sweet-romance",
    label: "Sweet romance",
    emoji: "💗",
    genres: ["Romance"],
    tags: ["Love Triangle", "Coming of Age", "School", "Heterosexual", "Unrequited Love"],
    minMatches: 2,
  },
  {
    vibe: "will-they-wont-they",
    label: "Will-they-won't-they",
    emoji: "💭",
    genres: ["Romance", "Comedy"],
    tags: ["Love Triangle", "School", "Workplace", "Tsundere", "Heterosexual", "Unrequited Love"],
    minMatches: 3,
  },
  {
    vibe: "forbidden-romance",
    label: "Forbidden romance",
    emoji: "🌙",
    genres: ["Romance", "Drama"],
    tags: ["Forbidden Love", "Age Gap", "Taboo", "Secret Relationship", "Affair"],
    minMatches: 2,
  },
  {
    vibe: "office-romance",
    label: "Office romance",
    emoji: "💼",
    genres: ["Romance", "Slice of Life"],
    tags: ["Workplace", "Office", "Coworker", "Adult", "Salaryman"],
    minMatches: 2,
  },

  // ─── Comedy (4) — minMatches: 1 so Comedy genre alone fires ───
  {
    vibe: "absurd-parody",
    label: "Absurd parody",
    emoji: "🤪",
    genres: ["Comedy"],
    tags: ["Parody", "Gag Humor", "Slapstick", "Satire", "Meta", "Absurd", "Surreal Comedy"],
    minMatches: 1,
  },
  {
    vibe: "laugh-out-loud",
    label: "Laugh-out-loud",
    emoji: "😂",
    genres: ["Comedy"],
    tags: ["Slapstick", "Gag Humor", "Misunderstanding", "Ensemble Cast", "Surreal Comedy", "Comedy"],
    minMatches: 1,
  },
  {
    vibe: "wholesome-comedy",
    label: "Wholesome comedy",
    emoji: "😊",
    genres: ["Comedy", "Slice of Life"],
    tags: ["School", "Friendship", "Family", "Workplace", "Cute", "Cute Girls Doing Cute Things", "Iyashikei", "Found Family", "Family Life"],
    minMatches: 2,
  },
  {
    vibe: "situational-cringe-comedy",
    label: "Situational cringe comedy",
    emoji: "😅",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Misunderstanding", "Embarrassing", "Awkward", "Cringe", "Social Anxiety", "Surreal Comedy"],
    minMatches: 2,
  },

  // ─── School / work (4) ───
  {
    vibe: "school-life-drama",
    label: "School life drama",
    emoji: "🎒",
    genres: ["Drama", "Romance", "Slice of Life"],
    tags: ["School", "High School", "Middle School", "Student Council", "Classroom", "Primarily Teen Cast", "Boarding School", "Bullying"],
    minMatches: 3, // Raised to 3 so it doesn't beat musical-passion on YLiA
  },
  {
    vibe: "school-club",
    label: "School club",
    emoji: "🖇️",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Club", "School Club", "After School", "Light Music", "Tea", "Brass Band"],
    minMatches: 2,
  },
  {
    vibe: "workplace-comedy",
    label: "Workplace comedy",
    emoji: "📊",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Workplace", "Office", "Salaryman", "Company", "Coworker", "Boss", "Work", "Family Life"],
    minMatches: 2,
  },
  {
    vibe: "cram-school-pressure",
    label: "Cram school pressure",
    emoji: "📚",
    genres: ["Drama", "Slice of Life"],
    tags: ["Cram School", "Exam", "Study", "Entrance Exam", "Pressure", "Academic"],
    minMatches: 2,
  },

  // ─── Cozy / warm (5) ───
  {
    vibe: "healing-wholesome",
    label: "Healing & wholesome",
    emoji: "🌿",
    genres: ["Slice of Life"],
    tags: ["Iyashikei", "Healing", "Cute Girls Doing Cute Things", "CGDCT"],
    minMatches: 2,
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
    tags: ["Family", "Friendship", "School", "Coming of Age", "Pets", "Found Family", "Family Life"],
    minMatches: 2,
  },
  {
    vibe: "childhood-nostalgia",
    label: "Childhood nostalgia",
    emoji: "🪁",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Childcare", "Kids", "Nostalgia", "Family Friendly", "Primarily Child Cast"],
    minMatches: 2,
  },
  {
    vibe: "everyday-comfort",
    label: "Everyday comfort",
    emoji: "🫖",
    genres: ["Slice of Life"],
    tags: ["Daily Life", "Quiet", "Countryside", "Tea", "Slow Paced", "Episodic"],
    minMatches: 2,
  },

  // ─── Food / lifestyle (3) ───
  {
    vibe: "cooking-food",
    label: "Cooking & food",
    emoji: "🍳",
    genres: ["Gourmet", "Slice of Life", "Comedy"],
    tags: ["Cooking", "Food", "Restaurant", "Chef", "Cuisine", "Recipe"],
    minMatches: 1,
  },
  {
    vibe: "travel-journey",
    label: "Travel & journey",
    emoji: "🧳",
    genres: ["Adventure", "Slice of Life"],
    tags: ["Travel", "Journey", "Road Trip", "Exploration", "Tourism", "Wandering"],
    minMatches: 2,
  },
  {
    vibe: "festival-cultural",
    label: "Festival & cultural",
    emoji: "🎏",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Festival", "Matsuri", "Cultural", "Tradition", "Shrine", "Summer Festival"],
    minMatches: 2,
  },

  // ─── Surreal / philosophical (3) ───
  {
    vibe: "surreal-dreamlike",
    label: "Surreal & dreamlike",
    emoji: "🌀",
    genres: ["Psychological", "Supernatural", "Mystery"],
    tags: ["Surreal", "Dreams", "Abstract", "Mind Trip", "Surrealism", "Avant-garde", "Surreal Comedy"],
    minMatches: 2,
  },
  {
    vibe: "philosophical",
    label: "Philosophical",
    emoji: "🤔",
    genres: ["Psychological", "Drama", "Sci-Fi"],
    tags: ["Philosophy", "Existential", "Ethics", "Morality", "Meaning", "Nihilism"],
    minMatches: 2,
  },
  {
    vibe: "coming-of-age",
    label: "Coming of age",
    emoji: "🌱",
    genres: ["Drama", "Slice of Life", "Romance"],
    tags: ["Coming of Age", "Growing Up", "Adolescence", "Adulthood", "Self-Discovery"],
    minMatches: 3, // Raised to 3 so it doesn't win ties against comedy rules
  },
];

/**
 * Infer the strongest vibe for an anime from its genres + tags.
 * Returns null if no rule matches.
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
    // If requireAllGenres is set, ALL listed genres must be present.
    // This prevents tags (worth 2x) from compensating for a missing genre.
    if (rule.requireAllGenres && genreMatches < rule.genres.length) continue;
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

/** Map a Vibe to the onboarding MoodPreference. Must be exhaustive. */
export function vibeToMood(vibe: Vibe): "action" | "cozy" | "funny" | "romance" | "mystery" | "dark" {
  switch (vibe) {
    case "cozy-slow-burn":
    case "heartwarming-slice-of-life":
    case "healing-wholesome":
    case "childhood-nostalgia":
    case "everyday-comfort":
      return "cozy";
    case "high-energy-action":
    case "explosive-shounen":
    case "mecha-warfare":
    case "martial-arts-epic":
    case "gun-fu-frenzy":
      return "action";
    case "mind-bending-mystery":
    case "supernatural-thriller":
    case "detective-noir":
    case "survival-horror":
    case "conspiracy-uncovered":
      return "mystery";
    case "sweet-romance":
    case "bittersweet-romance":
    case "will-they-wont-they":
    case "forbidden-romance":
    case "office-romance":
      return "romance";
    case "dark-psychological":
    case "tragic-drama":
    case "grimdark-fantasy":
    case "post-apocalyptic":
    case "revenge-saga":
      return "dark";
    case "laugh-out-loud":
    case "absurd-parody":
    case "wholesome-comedy":
    case "situational-cringe-comedy":
      return "funny";
    case "epic-adventure":
    case "isekai-fantasy":
    case "magical-world":
    case "treasure-hunt":
    case "lost-world":
      return "action";
    case "cyberpunk-future":
    case "space-opera":
    case "time-bending-sci-fi":
    case "virtual-reality-game":
    case "ai-existential":
      return "action";
    case "musical-passion":
    case "creative-pursuits":
    case "idol-stardom":
      return "cozy";
    case "sports-rivalry":
    case "underdog-story":
    case "tournament-arc":
    case "team-spirit":
      return "action";
    case "historical-period":
    case "samurai-feudal":
    case "military-war-drama":
    case "political-intrigue":
      return "action";
    case "school-life-drama":
    case "school-club":
    case "workplace-comedy":
    case "cram-school-pressure":
      return "cozy";
    case "cooking-food":
    case "travel-journey":
    case "festival-cultural":
      return "cozy";
    case "surreal-dreamlike":
    case "philosophical":
    case "coming-of-age":
      return "mystery";
  }
}
