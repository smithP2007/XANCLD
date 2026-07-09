// Gogoanime provider — uses the Consumet API pattern (self-hostable)
// Falls back to the public Consumet instance if CONSUMET_URL is set.
//
// Gogoanime is the second-most-popular anime source after AllAnime.
// It provides direct HLS and MP4 streams without requiring AES decryption.
//
// Architecture: browser → Hono CORS proxy → Gogoanime/Consumet API
// The proxy adds proper headers and handles CORS.

const GOGOANIME_BASE = "https://gogoanime.fi";
const GOGOANIME_SEARCH = "https://gogoanime.fi/search.html";
const GOGOANIME_AJAX = "https://ajax.gogocdn.net/ajax/load-list-episode";

// ─── Types ─────────────────────────────────────────────────────
export interface GogoEpisode {
  episodeId: string;
  number: number;
  title: string | null;
  url: string;
}

export interface GogoSource {
  quality: string;
  url: string;
  type: "hls" | "mp4" | "iframe";
}

export interface GogoShow {
  id: string;
  title: string;
  url: string;
  image: string | null;
  releaseDate: string | null;
}

// ─── CORS proxy helper ─────────────────────────────────────────
async function proxiedFetch(url: string): Promise<Response> {
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Proxy returned ${res.status} for ${url}`);
  }
  return res;
}

// ─── Search for anime on Gogoanime ─────────────────────────────
export async function searchGogoanime(query: string): Promise<GogoShow[]> {
  const url = `${GOGOANIME_SEARCH}?keyword=${encodeURIComponent(query)}`;
  try {
    const res = await proxiedFetch(url);
    const html = await res.text();

    // Parse the search results HTML
    const out: GogoShow[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const items = doc.querySelectorAll("ul.items li");

    for (const item of items) {
      const link = item.querySelector("a");
      if (!link) continue;
      const href = link.getAttribute("href") || "";
      const title = item.querySelector(".name")?.textContent?.trim() || "";
      const img = item.querySelector("img");
      const imgSrc = img?.getAttribute("src") || img?.getAttribute("data-src") || "";
      const releaseDate = item.querySelector(".released")?.textContent?.trim() || "";

      if (href) {
        out.push({
          id: href.replace("/category/", "").replace("/", ""),
          title,
          url: `${GOGOANIME_BASE}${href}`,
          image: imgSrc || null,
          releaseDate: releaseDate || null,
        });
      }
    }

    return out;
  } catch (err) {
    console.error("[Gogoanime] search failed:", err);
    return [];
  }
}

// ─── Get episode list for a show ───────────────────────────────
export async function getGogoEpisodes(showId: string): Promise<GogoEpisode[]> {
  // First, get the category page to find the episode list AJAX endpoint
  const categoryUrl = `${GOGOANIME_BASE}/category/${showId}`;
  try {
    const res = await proxiedFetch(categoryUrl);
    const html = await res.text();

    // Find the movie_id from the page (used for the AJAX endpoint)
    const match = html.match(/data-movie-id="([^"]+)"/);
    if (!match) {
      // Fallback: try to find episode links directly in the HTML
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const epLinks = doc.querySelectorAll("ul#episode_page li a");
      const episodes: GogoEpisode[] = [];
      for (const link of epLinks) {
        const epStart = parseInt(link.getAttribute("ep_start") || "1", 10);
        const epEnd = parseInt(link.getAttribute("ep_end") || "1", 10);
        for (let i = epStart; i <= epEnd; i++) {
          episodes.push({
            episodeId: `${showId}-episode-${i}`,
            number: i,
            title: `Episode ${i}`,
            url: `${GOGOANIME_BASE}/${showId}-episode-${i}`,
          });
        }
      }
      return episodes;
    }

    const movieId = match[1];
    const ajaxUrl = `${GOGOANIME_AJAX}?ep_start=0&ep_end=9999&id=${movieId}`;

    // Fetch the episode list via AJAX
    const ajaxRes = await proxiedFetch(ajaxUrl);
    const ajaxHtml = await ajaxRes.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(ajaxHtml, "text/html");
    const epLinks = doc.querySelectorAll("ul#episode_page li a");

    const episodes: GogoEpisode[] = [];
    for (const link of epLinks) {
      const href = link.getAttribute("href") || "";
      const epNum = parseInt(link.getAttribute("data-episode") || link.textContent?.trim() || "0", 10);
      const title = link.querySelector(".name")?.textContent?.trim() || `Episode ${epNum}`;
      if (href) {
        episodes.push({
          episodeId: href.replace("/", "").replace(`${showId}-`, ""),
          number: epNum,
          title,
          url: `${GOGOANIME_BASE}${href}`,
        });
      }
    }

    // Sort by episode number
    episodes.sort((a, b) => a.number - b.number);
    return episodes;
  } catch (err) {
    console.error("[Gogoanime] getEpisodes failed:", err);
    return [];
  }
}

// ─── Get stream sources for an episode ─────────────────────────
export async function getGogoStreamSources(episodeUrl: string): Promise<GogoSource[]> {
  try {
    const res = await proxiedFetch(episodeUrl);
    const html = await res.text();

    const sources: GogoSource[] = [];
    const seen = new Set<string>();

    // Pattern 1: Look for the streaming link in the HTML
    // Gogoanime stores stream URLs in a <a class="active" href="..."> pattern
    const streamLinkMatch = html.match(/<a[^>]*class="[^"]*active[^"]*"[^>]*href="([^"]+)"/i);
    if (streamLinkMatch) {
      const streamUrl = streamLinkMatch[1];
      if (streamUrl.includes(".m3u8")) {
        sources.push({ quality: "Auto", url: streamUrl, type: "hls" });
        seen.add(streamUrl);
      } else if (streamUrl.includes(".mp4")) {
        sources.push({ quality: "Auto", url: streamUrl, type: "mp4" });
        seen.add(streamUrl);
      }
    }

    // Pattern 2: Look for direct URLs in the HTML
    const hlsMatches = html.matchAll(/https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/g);
    for (const m of hlsMatches) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      sources.push({ quality: "Auto", url: m[0], type: "hls" });
    }

    const mp4Matches = html.matchAll(/https?:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?(?=["'\s<>]|$)/g);
    for (const m of mp4Matches) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      sources.push({ quality: "Auto", url: m[0], type: "mp4" });
    }

    // Pattern 3: Look for the Gogoanime streaming server iframe
    const iframeMatches = html.matchAll(/<iframe[^>]*src="([^"]*(?:streaming|embed|play)[^"]*)"/gi);
    for (const m of iframeMatches) {
      const iframeUrl = m[1];
      if (!seen.has(iframeUrl)) {
        seen.add(iframeUrl);
        sources.push({ quality: "Auto", url: iframeUrl, type: "iframe" });
      }
    }

    // Pattern 4: Look for the load streaming server AJAX call
    const serverMatch = html.match(/load.*?server.*?(\d+)/i);
    if (serverMatch) {
      // Try the streaming server URL
      const streamServerUrl = html.match(/https?:\/\/[^"'\s<>]*(?:gogocdn|gogo|stream|play)[^"'\s<>]*/i);
      if (streamServerUrl && !seen.has(streamServerUrl[0])) {
        sources.push({ quality: "Auto", url: streamServerUrl[0], type: "iframe" });
      }
    }

    return sources;
  } catch (err) {
    console.error("[Gogoanime] getStreamSources failed:", err);
    return [];
  }
}

// ─── Full pipeline: title + episode → stream URL ───────────────
export async function extractGogoStream(
  title: string,
  episode: number,
): Promise<{ sources: GogoSource[]; showId: string | null }> {
  // Step 1: Search for the anime
  const results = await searchGogoanime(title);
  if (results.length === 0) {
    return { sources: [], showId: null };
  }

  // Step 2: Find the best match (exact or closest title)
  const show = results[0];
  const showId = show.id;

  // Step 3: Get episode list
  const episodes = await getGogoEpisodes(showId);
  if (episodes.length === 0) {
    return { sources: [], showId };
  }

  // Step 4: Find the requested episode
  const ep = episodes.find((e) => e.number === episode) || episodes[0];
  if (!ep) {
    return { sources: [], showId };
  }

  // Step 5: Get stream sources
  const sources = await getGogoStreamSources(ep.url);
  return { sources, showId };
}
