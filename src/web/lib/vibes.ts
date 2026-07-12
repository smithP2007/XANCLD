/**
 * vibes.ts — shared mood/vibe inference from genres + tags.
 *
 * 60 vibe rules across 15 categories. Each rule has curated genre + tag
 * matchers. Tags are weighted 2x heavier than genres (tags are far more
 * discriminating — "Iyashikei" or "Time Travel" vs generic "Action").
 *
 * CRITICAL: AniList genres are a FIXED enum: Action, Adventure, Comedy,
 * Drama, Fantasy, Horror, Mecha, Music, Mystery, Psychological, Romance,
 * Sci-Fi, Slice of Life, Sports, Supernatural, Thriller, Suspense, Award
 * Winning, Gourmet, Reincarnation, Ecchi, Erotica, Hentai.
 *
 * Everything else (Shounen, Ninja, Martial Arts, Historical, Military,
 * Iyashikei, Time Travel, etc.) is a TAG, not a genre. Putting tags in the
 * `genres` array is a bug — they'll never match. All tag-only entries have
 * been moved to the `tags` array.
 *
 * MATCHING LOGIC:
 * - genreMatches = count of rule.genres that appear in the anime's genres (each worth 1 point)
 * - tagMatches = count of rule.tags that appear in the anime's tags (each worth 2 points)
 * - totalScore = genreMatches + tagMatches * 2
 * - Rule fires if totalScore >= minMatches
 * - Highest-scoring rule wins; ties go to the first rule in the array
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
  /** AniList GENRES that match (Action, Adventure, Comedy, Drama, Fantasy,
   *  Horror, Mecha, Music, Mystery, Psychological, Romance, Sci-Fi, Slice
   *  of Life, Sports, Supernatural, Thriller, Suspense, Award Winning,
   *  Gourmet, Reincarnation, Ecchi). Each match = 1 point. */
  genres: string[];
  /** AniList TAGS that match (Shounen, Ninja, Iyashikei, Time Travel, etc.).
   *  Each match = 2 points. Tags are far more discriminating. */
  tags?: string[];
  /** Minimum total score required for the rule to fire. Default 1.
   *  Since tags are worth 2 and genres worth 1, setting minMatches to 2
   *  means: need 2 genre matches, OR 1 tag match, OR 1 genre + nothing. */
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
    tags: ["Family", "Friendship", "School", "Coming of Age", "Pets"],
    minMatches: 2,
  },
  {
    vibe: "childhood-nostalgia",
    label: "Childhood nostalgia",
    emoji: "🪁",
    genres: ["Slice of Life", "Comedy"],
    tags: ["Childcare", "Kids", "Nostalgia", "Family Friendly"],
    minMatches: 2,
  },
  {
    vibe: "everyday-comfort",
    label: "Everyday comfort",
    emoji: "🫖",
    genres: ["Slice of Life"],
    tags: ["Daily Life", "Quiet", "Countryside", "Tea", "Slow Paced"],
    minMatches: 2,
  },

  // ─── Action / energy (5) ────────────────────────────────────────
  {
    vibe: "explosive-shounen",
    label: "Explosive shounen battles",
    emoji: "💥",
    genres: ["Action", "Adventure"],
    tags: ["Shounen", "Battle", "Super Power", "Power Suit", "Fighting", "Swordplay"],
    minMatches: 3, // Need Action+Adventure+something, or Action+1 tag
  },
  {
    vibe: "high-energy-action",
    label: "High-energy action",
    emoji: "🔥",
    genres: ["Action"],
    tags: ["Battle", "Martial Arts", "Super Power", "Gunfights", "Assassins", "Ninja"],
    minMatches: 2, // Need Action + 1 tag (not just Action alone)
  },
  {
    vibe: "mecha-warfare",
    label: "Mecha warfare",
    emoji: "🤖",
    genres: ["Mecha"],
    tags: ["Robots", "Military", "Real Robot", "Super Robot"],
    minMatches: 1, // Mecha genre alone is specific enough
  },
  {
    vibe: "martial-arts-epic",
    label: "Martial arts epic",
    emoji: "🥋",
    genres: ["Action"],
    tags: ["Martial Arts", "Fighting", "Training", "Tournament"],
    minMatches: 2, // Need Action + martial arts tag
  },
  {
    vibe: "gun-fu-frenzy",
    label: "Gun-fu frenzy",
    emoji: "🔫",
    genres: ["Action"],
    tags: ["Gunfights", "Assassins", "Mercenaries", "Sniper", "Crime", "Mafia"],
    minMatches: 2, // Need Action + gun/crime tag
  },

  // ─── Mystery / thriller (5) ────────────────────────────────────
  {
    vibe: "detective-noir",
    label: "Detective noir",
    emoji: "🕵️",
    genres: ["Mystery", "Thriller"],
    tags: ["Detective", "Police", "Investigation", "Crime", "Noir"],
    minMatches: 2,
  },
  {
    vibe: "mind-bending-mystery",
    label: "Mind-bending mystery",
    emoji: "🔍",
    genres: ["Mystery", "Psychological"],
    tags: ["Time Travel", "Mind Games", "Conspiracy", "Memory Manipulation", "Dreams"],
    minMatches: 2,
  },
  {
    vibe: "supernatural-thriller",
    label: "Supernatural thriller",
    emoji: "👁️",
    genres: ["Supernatural", "Thriller", "Horror"],
    tags: ["Ghosts", "Demons", "Vampires", "Zombies", "Curses", "Occult"],
    minMatches: 2,
  },
  {
    vibe: "survival-horror",
    label: "Survival horror",
    emoji: "🔪",
    genres: ["Horror", "Thriller"],
    tags: ["Survival", "Gore", "Zombies", "Apocalypse", "Slasher", "Body Horror"],
    minMatches: 2,
  },
  {
    vibe: "conspiracy-uncovered",
    label: "Conspiracy uncovered",
    emoji: "🧩",
    genres: ["Mystery", "Thriller"],
    tags: ["Conspiracy", "Secret Organization", "Government", "Whistleblower", "Cover-up"],
    minMatches: 2,
  },

  // ─── Romance (5) ───────────────────────────────────────────────
  {
    vibe: "sweet-romance",
    label: "Sweet romance",
    emoji: "💗",
    genres: ["Romance"],
    tags: ["Love Triangle", "Coming of Age", "School"],
    minMatches: 2, // Need Romance + 1 tag
  },
  {
    vibe: "bittersweet-romance",
    label: "Bittersweet romance",
    emoji: "🍂",
    genres: ["Romance", "Drama"],
    tags: ["Tragedy", "Lost Love", "Separation", "Illness", "Memory"],
    minMatches: 2,
  },
  {
    vibe: "will-they-wont-they",
    label: "Will-they-won't-they",
    emoji: "💭",
    genres: ["Romance", "Comedy"],
    tags: ["Love Triangle", "School", "Workplace", "Tsundere"],
    minMatches: 3, // Need Romance+Comedy+tag, or Romance+2 tags
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

  // ─── Dark / serious (5) ────────────────────────────────────────
  {
    vibe: "dark-psychological",
    label: "Dark psychological",
    emoji: "🌑",
    genres: ["Psychological", "Horror"],
    tags: ["Psychological", "Gore", "Survival", "Dark", "Mind Games", "Insanity"],
    minMatches: 2,
  },
  {
    vibe: "tragic-drama",
    label: "Tragic drama",
    emoji: "💧",
    genres: ["Drama"],
    tags: ["Tragedy", "Illness", "Loss", "War", "Suffering", "Tearjerker"],
    minMatches: 2, // Need Drama + tragic tag
  },
  {
    vibe: "grimdark-fantasy",
    label: "Grimdark fantasy",
    emoji: "⚔️",
    genres: ["Fantasy"],  // ONLY Fantasy — removed Action/Adventure which caused over-matching
    tags: ["Dark Fantasy", "Gore", "War", "Revenge", "Curses", "Demons", "Death"],
    minMatches: 2, // Need Fantasy + a dark tag — prevents every action anime from matching
  },
  {
    vibe: "post-apocalyptic",
    label: "Post-apocalyptic",
    emoji: "☢️",
    genres: ["Sci-Fi", "Drama"],
    tags: ["Apocalypse", "Post-Apocalyptic", "Survival", "Wasteland", "Nuclear"],
    minMatches: 2, // Need Sci-Fi/Drama + apocalypse tag
  },
  {
    vibe: "revenge-saga",
    label: "Revenge saga",
    emoji: "🗡️",
    genres: ["Action", "Drama"],
    tags: ["Revenge", "Vengeance", "Betrayal", "Grudge", "Payback"],
    minMatches: 3, // Need Action+Drama+revenge tag
  },

  // ─── Comedy (4) ───────────────────────────────────────────────
  // Comedy rules use minMatches: 1 so the Comedy genre alone is enough to
  // fire — this ensures EVERY comedy anime gets a comedy vibe. Tag matches
  // then determine WHICH comedy vibe wins (absurd-parody vs laugh-out-loud
  // vs wholesome-comedy). "Surreal Comedy" is a very common AniList tag.
  {
    vibe: "absurd-parody",
    label: "Absurd parody",
    emoji: "🤪",
    genres: ["Comedy"],
    tags: ["Parody", "Gag Humor", "Slapstick", "Satire", "Meta", "Absurd", "Surreal Comedy"],
    minMatches: 1, // Comedy genre alone fires; tags determine which comedy vibe wins
  },
  {
    vibe: "laugh-out-loud",
    label: "Laugh-out-loud",
    emoji: "😂",
    genres: ["Comedy"],
    tags: ["Slapstick", "Gag Humor", "Misunderstanding", "Ensemble Cast", "Surreal Comedy", "Comedy"],
    minMatches: 1, // Comedy genre alone fires
  },
  {
    vibe: "wholesome-comedy",
    label: "Wholesome comedy",
    emoji: "😊",
    genres: ["Comedy", "Slice of Life"],
    tags: ["School", "Friendship", "Family", "Workplace", "Cute", "Cute Girls Doing Cute Things", "Iyashikei"],
    minMatches: 2, // Need Comedy+SoL, or Comedy+wholesome tag
  },
  {
    vibe: "situational-cringe-comedy",
    label: "Situational cringe comedy",
    emoji: "😅",
    genres: ["Comedy", "Slice of Life"],
    tags: ["Misunderstanding", "Embarrassing", "Awkward", "Cringe", "Social Anxiety", "Surreal Comedy"],
    minMatches: 2,
  },

  // ─── Adventure / fantasy (5) ───────────────────────────────────
  {
    vibe: "isekai-fantasy",
    label: "Isekai fantasy",
    emoji: "🌀",
    genres: ["Adventure", "Fantasy"],
    tags: ["Isekai", "Reincarnation", "Transported", "Another World", "Fantasy World"],
    minMatches: 3, // Need Adventure+Fantasy+isekai tag, or 1 genre+1 tag
  },
  {
    vibe: "epic-adventure",
    label: "Epic adventure",
    emoji: "🗺️",
    genres: ["Adventure", "Fantasy"],
    tags: ["Journey", "Quest", "Exploration", "Treasure Hunt", "Pirates"],
    minMatches: 3, // Need both genres + tag, or 1 genre + 1 tag
  },
  {
    vibe: "magical-world",
    label: "Magical world",
    emoji: "✨",
    genres: ["Fantasy", "Supernatural"],
    tags: ["Magic", "Wizards", "Witches", "Magical Girl", "Fairy Tale", "Mythology"],
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
    tags: ["Lost World", "Ancient Civilization", "Uncharted", "Dungeon", "Labyrinth"],
    minMatches: 2,
  },

  // ─── Sci-fi / tech (5) ─────────────────────────────────────────
  {
    vibe: "cyberpunk-future",
    label: "Cyberpunk future",
    emoji: "🌃",
    genres: ["Sci-Fi"],
    tags: ["Cyberpunk", "AI", "Hacking", "Dystopia", "Megacorp", "Net"],
    minMatches: 2, // Need Sci-Fi + cyberpunk tag
  },
  {
    vibe: "space-opera",
    label: "Space opera",
    emoji: "🚀",
    genres: ["Sci-Fi"],
    tags: ["Space", "Spaceship", "Aliens", "Galactic", "Space Opera", "Interstellar"],
    minMatches: 2, // Need Sci-Fi + space tag
  },
  {
    vibe: "time-bending-sci-fi",
    label: "Time-bending sci-fi",
    emoji: "⏳",
    genres: ["Sci-Fi", "Mystery"],
    tags: ["Time Travel", "Time Loop", "Alternate Timeline", "Butterfly Effect", "Paradox"],
    minMatches: 2,
  },
  {
    vibe: "virtual-reality-game",
    label: "Virtual reality game",
    emoji: "🎮",
    genres: ["Sci-Fi", "Action"],
    tags: ["VR", "Virtual Reality", "MMORPG", "Video Game", "Death Game"],
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

  // ─── Music / arts (3) ──────────────────────────────────────────
  {
    vibe: "musical-passion",
    label: "Musical passion",
    emoji: "🎵",
    genres: ["Music"],
    tags: ["Band", "Idol", "Singing", "Instrument", "Concert", "Rock"],
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

  // ─── Sports / competition (4) ──────────────────────────────────
  {
    vibe: "sports-rivalry",
    label: "Sports rivalry",
    emoji: "🏆",
    genres: ["Sports"],
    tags: ["Basketball", "Soccer", "Baseball", "Volleyball", "Tennis", "Swimming", "Boxing"],
    minMatches: 1, // Sports genre alone is specific enough
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
    minMatches: 2, // Need Action/Sports + tournament tag
  },
  {
    vibe: "team-spirit",
    label: "Team spirit",
    emoji: "🤝",
    genres: ["Sports", "Slice of Life"],
    tags: ["Team", "Basketball", "Soccer", "Baseball", "Volleyball", "Cooperation"],
    minMatches: 2,
  },

  // ─── Historical / cultural (4) ─────────────────────────────────
  // NOTE: "Historical" is an AniList tag, not a genre. "Samurai",
  // "Military" are also tags. These rules rely on tags for matching.
  {
    vibe: "historical-period",
    label: "Historical period",
    emoji: "📜",
    genres: ["Drama", "Romance"],
    tags: ["Historical", "Period Piece", "Edo", "Meiji", "Taisho", "Showa", "Victorian"],
    minMatches: 2, // Need Drama/Romance + historical tag
  },
  {
    vibe: "samurai-feudal",
    label: "Samurai & feudal Japan",
    emoji: "⚔️",
    genres: ["Action", "Adventure"],
    tags: ["Samurai", "Shogun", "Feudal", "Katana", "Bushi", "Ronin", "Ninja"],
    minMatches: 2, // Need Action/Adventure + samurai tag
  },
  {
    vibe: "military-war-drama",
    label: "Military war drama",
    emoji: "🎖️",
    genres: ["Drama", "Action"],
    tags: ["Military", "War", "Soldiers", "Army", "Navy", "Air Force", "Combat"],
    minMatches: 2, // Need Drama/Action + military tag
  },
  {
    vibe: "political-intrigue",
    label: "Political intrigue",
    emoji: "♛",
    genres: ["Drama", "Mystery"],
    tags: ["Politics", "Kingdom", "Throne", "Betrayal", "Coup", "Empire"],
    minMatches: 2,
  },

  // ─── School / work (4) ─────────────────────────────────────────
  {
    vibe: "school-life-drama",
    label: "School life drama",
    emoji: "🎒",
    genres: ["Drama", "Romance", "Slice of Life"],
    tags: ["School", "High School", "Middle School", "Student Council", "Classroom"],
    minMatches: 2, // Need genre + school tag
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
    tags: ["Workplace", "Office", "Salaryman", "Company", "Coworker", "Boss"],
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

  // ─── Food / lifestyle (3) ──────────────────────────────────────
  {
    vibe: "cooking-food",
    label: "Cooking & food",
    emoji: "🍳",
    genres: ["Gourmet", "Slice of Life", "Comedy"],
    tags: ["Cooking", "Food", "Restaurant", "Chef", "Cuisine", "Recipe"],
    minMatches: 1, // Gourmet genre alone is specific enough; or SoL/Comedy + food tag
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

  // ─── Surreal / philosophical (3) ───────────────────────────────
  {
    vibe: "surreal-dreamlike",
    label: "Surreal & dreamlike",
    emoji: "🌀",
    genres: ["Psychological", "Supernatural", "Mystery"],
    tags: ["Surreal", "Dreams", "Abstract", "Mind Trip", "Surrealism", "Avant-garde"],
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
    minMatches: 2,
  },
];

/**
 * Infer the strongest vibe for an anime from its genres + tags.
 * Returns null if no rule matches (the anime is generic or unknown).
 *
 * Tags are weighted 2x heavier than genres: tags are far more discriminating
 * in anime (most Shounen share Action/Adventure/Comedy, but tags like
 * "Iyashikei" or "Time Travel" are specific).
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
