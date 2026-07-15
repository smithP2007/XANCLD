// ─── Anime domain types ─────────────────────────────────────────
// Plain TypeScript types + lightweight runtime validators (zod-style
// naming but hand-rolled so we don't pull a runtime dependency into the
// worker bundle). These are shared between the AniList client and the
// UI components.

import type { AnimeCard } from "../lib/anilist";

/** AniList FuzzyDate — year/month/day, each nullable. */
export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export const FuzzyDateSchema = {
  parse(v: unknown): FuzzyDate {
    const o = (v ?? {}) as Record<string, unknown>;
    const n = (x: unknown): number | null => {
      if (typeof x === "number" && Number.isFinite(x)) return x;
      return null;
    };
    return { year: n(o.year), month: n(o.month), day: n(o.day) };
  },
};

/** Format a FuzzyDate as "Apr 15, 2024" / "Apr 2024" / "2024" / "—". */
export function formatFuzzyDate(d: FuzzyDate | null | undefined): string {
  if (!d) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const y = d.year ?? null;
  const m = d.month ?? null;
  const day = d.day ?? null;
  if (y == null) return "—";
  if (m == null) return String(y);
  const monthStr = months[m - 1] ?? String(m);
  if (day == null) return `${monthStr} ${y}`;
  return `${monthStr} ${day}, ${y}`;
}

/** A single anime node inside a character's media edges. */
export interface CharacterMediaNode {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string; color?: string } | null;
  averageScore: number | null;
  format: string | null;
  seasonYear: number | null;
  season?: string | null;
  episodes?: number | null;
  type?: string | null;
}

export const CharacterMediaNodeSchema = {
  parse(v: unknown): CharacterMediaNode {
    const o = (v ?? {}) as Record<string, unknown>;
    const title = (o.title ?? {}) as Record<string, unknown>;
    const cover = (o.coverImage ?? null) as Record<string, unknown> | null;
    return {
      id: typeof o.id === "number" ? o.id : 0,
      title: {
        romaji: (title.romaji as string) ?? null,
        english: (title.english as string) ?? null,
        native: (title.native as string) ?? null,
      },
      coverImage: cover
        ? {
            large: (cover.large as string) ?? "",
            extraLarge: (cover.extraLarge as string) ?? (cover.large as string) ?? "",
            color: (cover.color as string) ?? undefined,
          }
        : null,
      averageScore: typeof o.averageScore === "number" ? o.averageScore : null,
      format: (o.format as string) ?? null,
      seasonYear: typeof o.seasonYear === "number" ? o.seasonYear : null,
      season: (o.season as string) ?? null,
      episodes: typeof o.episodes === "number" ? o.episodes : null,
      type: (o.type as string) ?? null,
    };
  },
};

/** A character→anime edge with a role. */
export interface CharacterMediaEdge {
  characterRole: string | null;
  media: CharacterMediaNode;
}

export const CharacterMediaEdgeSchema = {
  parse(v: unknown): CharacterMediaEdge {
    const o = (v ?? {}) as Record<string, unknown>;
    return {
      characterRole: (o.characterRole as string) ?? null,
      media: CharacterMediaNodeSchema.parse(o.media),
    };
  },
};

/** A voice-actor entry on a character (from Character.voiceActors). */
export interface VoiceActor {
  id: number;
  name: { full: string | null };
  image: { large: string | null } | null;
  language: string | null;
}

/** Full character detail returned by fetchCharacter(). */
export interface CharacterDetail {
  id: number;
  name: {
    full: string | null;
    native: string | null;
    alternative: string[];
  };
  image: { large: string | null; medium: string | null };
  description: string | null;
  dateOfBirth: FuzzyDate | null;
  age: string | null;
  gender: string | null;
  bloodType: string | null;
  media: CharacterMediaEdge[];
}

export const CharacterDetailSchema = {
  parse(v: unknown): CharacterDetail | null {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const name = (o.name ?? {}) as Record<string, unknown>;
    const image = (o.image ?? {}) as Record<string, unknown>;
    const dob = FuzzyDateSchema.parse(o.dateOfBirth);
    const mediaEdges = Array.isArray(o.media) ? o.media : [];
    return {
      id: typeof o.id === "number" ? o.id : 0,
      name: {
        full: (name.full as string) ?? null,
        native: (name.native as string) ?? null,
        alternative: Array.isArray(name.alternative)
          ? (name.alternative as unknown[]).filter((x): x is string => typeof x === "string")
          : [],
      },
      image: {
        large: (image.large as string) ?? null,
        medium: (image.medium as string) ?? null,
      },
      description: (o.description as string) ?? null,
      dateOfBirth: dob,
      age: (o.age as string) ?? null,
      gender: (o.gender as string) ?? null,
      bloodType: (o.bloodType as string) ?? null,
      media: mediaEdges
        .map((e) => CharacterMediaEdgeSchema.parse(e))
        .filter((e) => e.media.id !== 0)
        .sort((a, b) => (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))
        .slice(0, 25),
    };
  },
};

/** Re-export AnimeCard for convenience. */
export type { AnimeCard };
