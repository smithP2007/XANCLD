// ─── AniList GraphQL query strings ──────────────────────────────
// Centralized so we can review the exact fields requested. Each query
// lives next to its corresponding fetch function in lib/anilist.ts.

/**
 * Fetch a Character by ID — name (full + native + alternative), image,
 * description, date of birth, age, gender, blood type, and up to 25
 * anime appearances sorted by popularity.
 *
 * AniList returns edges with { characterRole, node } — we request
 * `media { ... }` (the node) and `characterRole` so we can display the
 * role (MAIN, SUPPORTING, BACKGROUND) as a badge on each appearance.
 */
export const CHARACTER_QUERY = `query Character($id: Int) {
  Character(id: $id) {
    id
    name { full native alternative }
    image { large medium }
    description(asHtml: false)
    dateOfBirth { year month day }
    age
    gender
    bloodType
    media(perPage: 25, sort: POPULARITY_DESC, type: ANIME) {
      edges {
        characterRole
        node {
          id
          title { romaji english native }
          coverImage { large extraLarge color }
          averageScore
          format
          seasonYear
          season
          episodes
          type
        }
      }
    }
  }
}`;
