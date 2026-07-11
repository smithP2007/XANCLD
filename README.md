<div align="center">

# 🎬 XANCLD

### Stream anime without the noise — on Cloudflare Workers Free tier

A modern, full-featured anime streaming web app built with **Hono + Vite + React**. Runs entirely on Cloudflare Workers Free tier ($0/month) using a Tier 2 client-side fetch architecture where the server is just a thin CORS proxy and the browser does all the heavy lifting (AES-GCM crypto, HTML scraping, video playback).

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

</div>

---

## ✨ Features

### 🎯 Core Experience
- **🎬 Cinematic Hero Carousel** — 5-slide auto-rotating hero with Ken Burns zoom, ambient color sync, desktop split layout + mobile card layout
- **🔍 Powerful Search** — Debounced search (400ms) with sort/format/genre filters, URL sync, prev/next pagination
- **📺 Trending & Popular** — Real-time trending and popular anime from AniList with scroll-snap horizontal scrollers
- **👤 Anime Details** — Cinematic detail page with 2/3+1/3 layout, windowed episodes (100/page) with search + jump-to-episode, Next Episode countdown, color-themed banner fallback, MAL-style status dropdown, bookmark button
- **🕐 Watch Schedule** — Day-of-week tabs with episode counts + TODAY badge, 3-state countdown (AIRED/IMMINENT/normal), timezone label
- **📺 Watch History** — Grouped-by-anime list with episode chips, time-ago labels, progress bars, real-time pub/sub updates
- **📚 My Library** — Bookmarks + MAL-style status lists (Watching/Completed/Planning/On Hold/Dropped) with grid/list view toggle
- **⚙️ Settings** — 8 sections (Appearance/Playback/Audio/Enhancer/Bandwidth/Content/Data/About), System theme, scroll-spy nav, search filter, responsive mobile layout
- **🎨 Premium UI** — Glassmorphism, gradient accents (crimson→violet), Ken Burns, mesh-shift ambient blobs, card-enter staggered animations, scroll-snap, responsive design

### 🎬 YouTube-Style Video Player
- **Custom controls** — Play/pause, skip back/forward, volume slider, time display toggle (current/duration ↔ current/-remaining), fullscreen, settings panel (speed grid + quality list)
- **Keyboard shortcuts** — Space/K (play), J/L (±10s), ←/→ (±5s), ↑/↓ (volume), M (mute), F (fullscreen), 0-9 (seek to N×10%), E (enhancer), N/P (next/prev episode), ? (shortcuts overlay)
- **Seek ripple feedback** — Animated ±10s indicator on J/L/arrow seeks
- **Mobile double-tap** — Double-tap left/right half to seek ±10s with tap ripple
- **Skip intro** — Button + marker notch on seekbar at 85s
- **Hover tooltip** — Timestamp preview on seekbar hover
- **Buffered range** — Translucent bar ahead of progress
- **Auto-play overlay** — 10s countdown with circular SVG progress ring
- **Video Enhancer** — 9 CSS GPU-accelerated filters (brightness, contrast, saturation, hue, blur, sepia, grayscale, gamma, sharpen) + 20 built-in presets + peek mode (hold to compare) + master on/off toggle. Works on both `<video>` and `<iframe>` players

### 🔌 Multi-Provider Stream Architecture
- **AllAnime** — mkissa.to AES-GCM crypto resolver (server-side in worker): fetches `__aaCrypto`, derives AES key via `XOR(atob(partB), MASK)`, signs `aaReq` proof, decrypts `tobeparsed` response. Dead source filtering (skips `/apivtwo/clock`, `ss-hls`, `sl-mp4`, `streamsb.net`, `streamlare.com`)
- **Koto** — megaplay.buzz iframe embed (trivial URL builder, always available)
- **Zen** — flixcloud.cc iframe embed via `/api/stream-zen` CORS proxy (dual audio)
- **Gogoanime** — gogoanime.fi HLS/MP4 scraping (disabled by default)
- **Source filters** — Toggle individual sources on/off + pin a single source (only pinned source loads, no fallback)

### 🎨 Design System
- **Colors**: XAN crimson `#e94560`, XAN violet `#7b2ff7`, dark `#0a0a0a`, with full light theme support
- **Typography**: Outfit (display), Nunito (body), loaded via Google Fonts
- **Glassmorphism**: `.glass` (blur 16px) and `.glass-strong` (blur 24px + saturate)
- **Animations**: Ken Burns, mesh-shift, hero-info-in, card-enter (staggered), xan-seek-ripple, xan-tap-ripple, xan-play-pop, xan-spinner, xan-panel-up, gradient-shift
- **Utilities**: mask-fade-r, text-stroke, no-scrollbar, grain-overlay, xan-seek/vol (custom range sliders)
- **Accessibility**: `.xan-reduce-motion` and `.xan-tv-mode` global kill-switches for reduced motion + low-power devices
- **Theme**: Dark / Light / System (auto-detects `prefers-color-scheme`)

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Server** | Hono 4.x | Thin CORS proxy + AllAnime crypto resolver |
| **Frontend** | Vite 6.x + React 19 | SPA with fast HMR and optimized builds |
| **Language** | TypeScript 5 | Type safety throughout |
| **Styling** | Tailwind CSS 4 | Utility-first CSS with `@theme inline` design tokens |
| **Video** | hls.js | HLS playback in browser |
| **Crypto** | WebCrypto API | AES-GCM signing + decryption (`crypto.subtle`) |
| **Icons** | Lucide React | SVG icon library |
| **Routing** | React Router 7 | Client-side routing |
| **State** | Custom hooks + localStorage | Settings, history, bookmarks, anime lists (all with pub/sub sync) |
| **Metadata** | AniList GraphQL | Anime info, search, trending, schedule |
| **Streaming** | AllAnime + Koto + Zen + Gogoanime | Multi-provider episode sources |
| **Deploy** | Cloudflare Workers | Edge deployment via Wrangler |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** or **Bun** (recommended)
- A **Cloudflare account** (free — sign up at [dash.cloudflare.com](https://dash.cloudflare.com))

### Installation

```bash
# Clone the repo
git clone https://github.com/smithP2007/XANCLD.git
cd XANCLD

# Install dependencies
bun install  # or npm install / pnpm install

# Start the dev server (port 3000)
bun run dev
```

Visit **http://localhost:3000** 🎉

### Development

The dev server uses Vite's built-in proxy to forward `/api/*` requests to a local wrangler dev instance:

```bash
# Terminal 1: Start the Hono worker (API proxy + crypto resolver)
bunx wrangler dev --port 3003

# Terminal 2: Start the Vite dev server (frontend)
bun run dev
```

---

## 📦 Deployment

### Deploy to Cloudflare Workers (Free tier)

```bash
# 1. Build the frontend
bun run build

# 2. Login to Cloudflare (opens browser)
bunx wrangler login

# 3. Deploy
bun run deploy
```

Your app will be live at `https://xancld.<your-subdomain>.workers.dev` 🎉

---

## 📁 Project Structure

```
XANCLD/
├── 📂 src/
│   ├── 📂 worker/
│   │   ├── index.ts              # Hono worker: CORS proxy + stream proxy + Zen proxy
│   │   └── allanimeCrypto.ts     # AllAnime mkissa.to AES-GCM crypto resolver
│   └── 📂 web/
│       ├── main.tsx              # React app entry + routing
│       ├── index.css             # Tailwind v4 @theme inline + XAN design system
│       ├── 📂 components/
│       │   ├── Navbar.tsx        # Fixed header with mobile menu + search toggle
│       │   ├── Footer.tsx        # 3-column footer grid
│       │   ├── AnimeCard.tsx     # Staggered card-enter, bookmark, hover play, color accent
│       │   ├── AnimeCardSkeleton.tsx  # Loading skeleton
│       │   ├── AnimeStatusButton.tsx  # MAL-style status dropdown
│       │   ├── HeroCarousel.tsx  # 5-slide auto-rotate, Ken Burns, ambient color sync
│       │   ├── ContinueWatching.tsx   # Horizontal scroller from history (pub/sub)
│       │   ├── SectionRow.tsx    # Reusable horizontal scroller with scroll-snap
│       │   ├── VideoPlayer.tsx   # YouTube-style player (700+ lines)
│       │   ├── VideoEnhancerPanel.tsx   # 20 presets + 9 sliders + peek mode
│       │   ├── KeyboardShortcutsOverlay.tsx  # ? key shows all 14 shortcuts
│       │   └── AutoPlayOverlay.tsx   # 10s SVG circular countdown
│       ├── 📂 routes/
│       │   ├── Landing.tsx       # Full-screen hero landing page
│       │   ├── Home.tsx          # Hero carousel + continue watching + trending + popular
│       │   ├── AnimeDetail.tsx   # Cinematic 2/3+1/3 layout, windowed episodes
│       │   ├── Watch.tsx         # Video player + servers sidebar + enhancer
│       │   ├── Search.tsx        # Debounced search + filters + pagination
│       │   ├── Trending.tsx      # Discover page with pagination
│       │   ├── Schedule.tsx      # Day-of-week tabs + 3-state countdowns
│       │   ├── History.tsx       # Grouped-by-anime list (pub/sub)
│       │   ├── MyLibrary.tsx     # Bookmarks + status lists with tabs
│       │   └── Settings.tsx      # 8-section responsive settings page
│       ├── 📂 lib/
│       │   ├── anilist.ts        # AniList GraphQL client (dynamic query building)
│       │   ├── allanime.ts       # AllAnime extractor (crypto fallback + dead source filtering)
│       │   ├── gogoanime.ts      # Gogoanime scraper (gogoanime.fi)
│       │   └── 📂 providers/
│       │       ├── koto.ts       # Koto (megaplay.buzz) iframe provider
│       │       └── zen.ts        # Zen (flixcloud.cc) iframe provider
│       └── 📂 hooks/
│           ├── useSettings.ts    # Settings + watch history (pub/sub) hooks
│           ├── useBookmarks.ts   # Bookmark store (pub/sub)
│           ├── useAnimeList.ts   # MAL-style status lists (pub/sub)
│           ├── useVideoEnhancer.ts   # Video enhancer (20 presets, 9 controls, peek mode)
│           ├── useDebounce.ts    # Generic value debouncer
│           └── useCountdownTick.ts   # Shared single-interval countdown tick
├── 📂 public/
│   ├── logo.svg                  # XAN gradient logo
│   └── placeholder.svg           # Fallback image
├── index.html                    # HTML entry (with pre-React theme script)
├── vite.config.ts                # Vite config (proxy + allowedHosts + build)
├── wrangler.toml                 # Cloudflare Workers config
├── tsconfig.json                 # TypeScript config
├── package.json
└── README.md
```

---

## 🔧 How It Works

### Multi-Provider Stream Architecture

```
Browser                    Cloudflare Worker (Free)         External APIs
───────                    ────────────────────────         ────────────
Home/Search ────────────────────────────────────────────────→ AniList GraphQL (direct, CORS ✅)

Watch page:
  1. Get anime detail ──────────────────────────────────────→ AniList GraphQL (direct)
  2. AllAnime episode:
     a. Try legacy query ──→ /api/proxy ──────────────────→ api.allanime.day
        (if AA_CRYPTO_MISSING ↓)
     b. Crypto fallback ──→ /api/allanime/episode ────────→ mkissa.to (__aaCrypto)
        (worker fetches __aaCrypto, derives AES key,        ↓ + api.allanime.day
         signs aaReq, decrypts tobeparsed)                  ↓ returns sourceUrls
  3. Zen (fallback) ─────→ /api/stream-zen ───────────────→ flixcloud.cc
     (CORS proxy)                                          ↓ returns player_url
  4. Koto (fallback) ────────→ direct iframe ─────────────→ megaplay.buzz
  5. Play video ────────────────────────────────────────────→ CDN direct (hls.js / iframe)
```

### AllAnime mkissa.to Crypto (in-worker)

As of mid-2026, AllAnime requires a signed `aaReq` AES-GCM extension on every episode query:

```typescript
// 1. Fetch __aaCrypto = {epoch, partB} from mkissa.to episode page
// 2. Derive AES key: key = XOR(atob(partB), hexToBytes(MASK))
// 3. Build aaReq: base64([0x01][iv(12)][AES-GCM-encrypt({v:1, ts, epoch, buildId, qh})])
// 4. POST to api.allanime.day with aaReq extension + x-build-id header
// 5. Decrypt tobeparsed (try new key, fall back to OLD sha256("Xot36i3lK3:v1"))
```

### Video Enhancer (GPU-accelerated)

Only CSS-native filter functions are used (brightness, contrast, saturate, hue-rotate, blur, sepia, grayscale) — these are GPU-accelerated and don't cause choppy playback. Gamma is approximated via brightness, sharpen via contrast. `will-change: filter` + `transform: translateZ(0)` force GPU compositing layers.

---

## ⚙️ Configuration

### `wrangler.toml`

```toml
name = "xancld"
main = "src/worker/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

[assets]
directory = "dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[observability]
enabled = true
```

### Worker API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/proxy?url=...` | GET | CORS proxy for AllAnime GraphQL + embed page scraping |
| `/api/proxy-post` | POST | CORS proxy for AllAnime search (POST with JSON body) |
| `/api/stream?url=...` | GET | Streaming proxy with Range support for MP4/HLS |
| `/api/allanime/episode` | GET | AllAnime mkissa.to crypto resolver (full AES-GCM pipeline) |
| `/api/stream-zen` | GET | Zen (flixcloud.cc) CORS proxy |
| `/api/health` | GET | Health check |

### Settings (stored in localStorage)

All user settings are stored in `localStorage` under `xan:settings`:

```json
{
  "theme": "dark",              // "dark" | "light" | "system"
  "autoplay": true,             // Auto-play next episode with 10s countdown
  "skipIntro": true,            // Show skip intro button
  "skipOutro": false,           // Show skip outro button
  "autoResume": true,           // Resume from last position
  "defaultMode": "sub",         // "sub" | "dub"
  "volume": 80,                 // 0-100
  "playbackRate": 1,            // 0.5, 0.75, 1, 1.25, 1.5, 2
  "hideSpoilers": false,        // Blur synopsis until clicked
  "hideAdult": false,           // Filter 18+ anime
  "reducedMotion": false,       // Disable animations
  "tvMode": false,              // Disable GPU-expensive effects
  "bandwidthMode": "auto",      // "auto" | "direct-only" | "proxy-only"
  "preferredProvider": "allanime",  // "allanime" | "koto" | "zen" | "gogoanime"
  "disabledSources": ["gogoanime"], // Source names to hide (gogoanime off by default)
  "pinnedSource": null,         // When set, only this source loads (no fallback)
  "enhancerEnabled": false      // Video enhancer master toggle
}
```

Watch history is stored under `xan:history` (capped at 50 entries, pub/sub sync).
Bookmarks are stored under `xan:bookmarks`.
Anime lists are stored under `xan:animelist`.
Video enhancer settings are stored under `xan-video-enhancer`.

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite dev server (port 3000) |
| `bun run build` | Build frontend to `dist/` |
| `bun run preview` | Preview the built frontend |
| `bun run deploy` | Build + deploy to Cloudflare Workers |
| `bun run dev:worker` | Start wrangler dev (API only, port 3003) |
| `bun run lint` | Run TypeScript check |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 🙏 Acknowledgments

- **[AniList](https://anilist.co)** — Anime metadata API (GraphQL, CORS-enabled)
- **[AllAnime](https://allanime.day)** / **[mkissa.to](https://mkissa.to)** — Episode sources + stream URLs
- **[Koto](https://megaplay.buzz)** — MegaPlay iframe embed provider
- **[Zen](https://flixcloud.cc)** — FlixCloud iframe embed provider
- **[Hono](https://hono.dev)** — Ultrafast web framework for Cloudflare Workers
- **[Vite](https://vitejs.dev)** — Next-generation frontend tooling
- **[React](https://react.dev)** — UI library
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first CSS framework
- **[hls.js](https://github.com/video-dev/hls.js)** — HLS playback library
- **[Lucide](https://lucide.dev)** — Icon library
- **[Cloudflare Workers](https://workers.cloudflare.com)** — Edge compute platform
- **[XAN](https://github.com/sundeepyt2/XAN)** — Original Next.js project that inspired the UI/UX design

---

## ⚠️ Disclaimer

This project is for **educational purposes only**. It demonstrates:
- Tier 2 client-side fetch architecture
- AES-GCM crypto signing in Cloudflare Workers
- Multi-provider stream orchestration
- Cloudflare Workers Free tier optimization

**Users are responsible for complying with their local laws and the terms of service of any third-party APIs used.** The maintainers do not host or stream any content. All streaming is performed via third-party APIs and the user is responsible for verifying they have the right to access such content in their jurisdiction.

---

<div align="center">

**Built with ❤️ on Cloudflare Workers Free tier**

[Report Bug](../../issues) · [Request Feature](../../issues) · [⬆ Back to Top](#-XANCLD)

</div>
