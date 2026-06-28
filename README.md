<div align="center">

# 🎬 XAN Hono

### Stream anime without the noise — on Cloudflare Workers Free tier

A modern, full-featured anime streaming web app built with **Hono + Vite + React**. Runs entirely on Cloudflare Workers Free tier ($0/month) using a Tier 2 client-side fetch architecture where the server is just a thin CORS proxy and the browser does all the heavy lifting (AES decryption, HTML scraping, video playback).

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
- **🎬 Real HLS/MP4 Video Playback** — Custom video player with hls.js, AES-256-CTR decryption in-browser via WebCrypto API
- **🔍 Powerful Search** — Debounced search via AniList GraphQL (direct browser→API, no proxy needed)
- **📺 Trending & Popular** — Real-time trending and popular anime from AniList
- **📂 Browse by Genre** — 15+ genres with instant tab switching
- **👤 Anime Details** — Full info pages with synopsis, characters, relations, recommendations, episode grid
- **🕐 Watch Schedule** — Currently airing anime with live countdown timers (ticks every second)
- **📺 Watch History** — LocalStorage-based history with progress bars and resume position
- **⚙️ Settings** — Theme (dark/light), autoplay, skip intro, default sub/dub, volume, playback speed
- **🎨 Premium UI** — Glassmorphism, gradient accents, smooth animations, hover effects, responsive design

### 🔌 Architecture — Tier 2 Client-Side Fetch
- **AniList GraphQL** — Called directly from the browser (CORS-enabled, no proxy needed)
- **AllAnime GraphQL** — Browser → Hono CORS proxy → AllAnime API (proxy adds proper User-Agent/Referer/Origin headers)
- **AES-256-CTR decryption** — Done in-browser via WebCrypto API (`crypto.subtle`), not on the server
- **HTML scraping** — Embed pages scraped in-browser via DOMParser
- **Video playback** — Browser loads stream URLs directly from AllAnime CDNs via hls.js / `<video>` / `<iframe>`

### 💰 Zero Cost
- **Cloudflare Workers Free tier** — $0/month
- 100k requests/day, 10ms CPU per request, 1 MiB worker bundle
- Worker bundle: ~86 KB (24× under the 1 MiB limit)
- Static assets served free via Workers Assets
- No VPS, no database, no proxy service required

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Server** | Hono 4.x | Thin CORS proxy (~86 KB bundle) |
| **Frontend** | Vite 6.x + React 19 | SPA with fast HMR and optimized builds |
| **Language** | TypeScript 5 | Type safety throughout |
| **Styling** | Tailwind CSS 4 | Utility-first CSS with custom XAN design tokens |
| **Video** | hls.js | HLS playback in browser |
| **Crypto** | WebCrypto API | AES-256-CTR decryption (`crypto.subtle`) |
| **Icons** | Lucide React | SVG icon library |
| **Routing** | React Router 7 | Client-side routing |
| **State** | Custom hooks + localStorage | Settings and watch history |
| **Metadata** | AniList GraphQL | Anime info, search, trending, schedule |
| **Streaming** | AllAnime API | Episode sources + stream URLs |
| **Deploy** | Cloudflare Workers | Edge deployment via Wrangler |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** or **Bun** (recommended)
- A **Cloudflare account** (free — sign up at [dash.cloudflare.com](https://dash.cloudflare.com))

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/xan-hono.git
cd xan-hono

# Install dependencies
bun install  # or npm install / pnpm install

# Start the dev server
bun run dev
```

Visit **http://localhost:5173** 🎉

### Development

The dev server uses Vite's built-in proxy to forward `/api/*` requests to a local wrangler dev instance:

```bash
# Terminal 1: Start the Hono worker (API proxy)
bunx wrangler dev --port 3003

# Terminal 2: Start the Vite dev server (frontend)
bun run dev
```

Or use the combined dev script (starts both):
```bash
bun run dev:all
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

Your app will be live at `https://xan-hono.<your-subdomain>.workers.dev` 🎉

### Try without an account (temporary preview)

```bash
# Deploy to a temporary Cloudflare preview account (valid 60 minutes)
bunx wrangler deploy --temporary
```

### Custom Domain

1. Add your domain to Cloudflare (free)
2. Update `wrangler.toml` with your custom domain
3. Run `bun run deploy`

---

## 📁 Project Structure

```
xan-hono/
├── 📂 src/
│   ├── 📂 worker/
│   │   └── index.ts              # Hono CORS proxy worker (~86 KB bundle)
│   └── 📂 web/
│       ├── main.tsx              # React app entry + routing
│       ├── index.css             # Tailwind + XAN design system
│       ├── 📂 components/
│       │   ├── Navbar.tsx        # Scroll-aware glassmorphism navbar
│       │   ├── Footer.tsx        # Footer with links
│       │   └── AnimeCard.tsx     # Hover-lift anime card
│       ├── 📂 routes/
│       │   ├── Landing.tsx       # Full-screen hero landing page
│       │   ├── Home.tsx          # Trending carousel + popular + genres
│       │   ├── AnimeDetail.tsx   # Cinematic detail page
│       │   ├── Watch.tsx         # Video player + episode sidebar
│       │   ├── Search.tsx        # Search results with pagination
│       │   ├── Trending.tsx      # Full trending grid
│       │   ├── Schedule.tsx      # Airing schedule with countdowns
│       │   ├── History.tsx       # Watch history (localStorage)
│       │   └── Settings.tsx      # 6-section settings page
│       ├── 📂 lib/
│       │   ├── anilist.ts        # AniList GraphQL client (browser→API direct)
│       │   └── allanime.ts       # AllAnime extractor (AES decrypt + scraping)
│       └── 📂 hooks/
│           └── useSettings.ts    # Settings + history hooks (localStorage)
├── 📂 public/
│   ├── logo.svg                  # XAN gradient logo
│   └── placeholder.svg           # Fallback image
├── index.html                    # HTML entry (with pre-React theme script)
├── vite.config.ts                # Vite config (proxy + build)
├── wrangler.toml                 # Cloudflare Workers config
├── tsconfig.json                 # TypeScript config
├── package.json
└── README.md
```

---

## 🎨 Design System

### Colors
| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--background` | `#0a0a0a` | `#fafafa` | Page background |
| `--foreground` | `#fafafa` | `#0a0a0a` | Primary text |
| `--primary` | `#e94560` | `#e94560` | XAN crimson (buttons, accents) |
| `--muted-foreground` | `#a1a1aa` | `#6b7280` | Secondary text |
| `--card` | `rgba(255,255,255,0.04)` | `rgba(0,0,0,0.03)` | Card backgrounds |
| `--border` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.1)` | Borders |
| XAN violet | `#a855f7` | `#a855f7` | Gradient accent |

### Typography
- **Display**: Outfit (headings)
- **Body**: Nunito
- **Mono**: JetBrains Mono (code, badges)

### Premium UI Features
- **Glassmorphism**: `.glass` (blur 12px) and `.glass-strong` (blur 20px + saturate)
- **Glow effects**: `.glow-crimson`, `.glow-violet`, `.pulse-glow`
- **Premium buttons**: `.btn-premium` with shine sweep animation
- **Hover lift**: `.hover-lift` — elements rise 4px on hover
- **Smooth animations**: `fadeInUp`, `scaleIn`, `slideIn` with cubic-bezier easing
- **Gradient text**: `.gradient-text` — crimson→violet gradient
- **Theme toggle**: Dark/Light with instant switching + localStorage persistence

---

## 🔧 How It Works

### Tier 2 Client-Side Fetch Architecture

```
Browser                    Cloudflare Worker (Free)         External APIs
───────                    ────────────────────────         ────────────
Home/Search ────────────────────────────────────────────────→ AniList GraphQL (direct, CORS ✅)

Watch page:
  1. Get anime detail ──────────────────────────────────────→ AniList GraphQL (direct)
  2. Search AllAnime ──→ POST /api/proxy-post ──→ POST ────→ AllAnime GraphQL
                         (2ms CPU, forwards       (with proper
                          with UA/Referer)         UA/Referer/Origin)
                                                              ↓ returns show _id
  3. Get episodes ────→ GET /api/proxy ─────────→ GET ────→ AllAnime API
                         (2ms CPU)                            ↓ returns encrypted tobeparsed
  4. AES-256-CTR decrypt (browser, WebCrypto) ←────────────── 10KB encrypted blob
     ~10ms in browser, 0ms on server
  5. Scrape embed ────→ GET /api/proxy ─────────→ GET ────→ filemoon/vizcloud/etc.
                         (2ms CPU)                            ↓ returns HTML with stream URLs
  6. Play video ────────────────────────────────────────────→ CDN direct (hls.js / iframe)
                                                              ↓ video bytes bypass Cloudflare entirely
```

### Why this works on Free tier

| Constraint | Limit | Our usage | Status |
|------------|-------|-----------|--------|
| Worker bundle size | 1 MiB | ~86 KB | ✅ 24× under |
| CPU per request | 10 ms | ~2-5 ms (just forwards fetch) | ✅ |
| Requests/day | 100k | Each episode = ~6 proxy requests | ✅ ~16k plays/day |
| Streaming bandwidth | — | ~0 (browser fetches video directly from CDN) | ✅ |

### AES-256-CTR Decryption (in-browser)

AllAnime encrypts its episode source URLs with AES-256-CTR. The decryption happens entirely in the browser using the WebCrypto API:

```typescript
// Key derivation: SHA-256("Xot36i3lK3:v1")
const keyBytes = await crypto.subtle.digest("SHA-256", passphrase);
const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-CTR" }, false, ["decrypt"]);

// Counter: IV (12 bytes) + [0,0,0,2] (4 bytes)
const counter = new Uint8Array(16);
counter.set(iv, 0);
counter[15] = 0x02;

// Decrypt
const plaintext = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 32 }, key, ciphertext);
```

---

## ⚙️ Configuration

### `wrangler.toml`

```toml
name = "xan-hono"
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

### Settings (stored in localStorage)

All user settings are stored in `localStorage` under `xan:settings`:

```json
{
  "theme": "dark",        // "dark" | "light"
  "autoplay": true,       // Auto-play next episode
  "skipIntro": true,      // Show skip intro button
  "defaultMode": "sub",   // "sub" | "dub"
  "volume": 80,           // 0-100
  "playbackRate": 1       // 0.5, 0.75, 1, 1.25, 1.5, 2
}
```

Watch history is stored under `xan:history` (capped at 50 entries).

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start Vite dev server (port 5173) |
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
- **[AllAnime](https://allanime.day)** — Episode sources + stream URLs
- **[Hono](https://hono.dev)** — Ultrafast web framework for Cloudflare Workers
- **[Vite](https://vitejs.dev)** — Next-generation frontend tooling
- **[React](https://react.dev)** — UI library
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first CSS framework
- **[hls.js](https://github.com/video-dev/hls.js)** — HLS playback library
- **[Lucide](https://lucide.dev)** — Icon library
- **[Cloudflare Workers](https://workers.cloudflare.com)** — Edge compute platform

---

## ⚠️ Disclaimer

This project is for **educational purposes only**. It demonstrates:
- Tier 2 client-side fetch architecture
- AES-256-CTR decryption in the browser via WebCrypto
- Cloudflare Workers Free tier optimization
- Multi-API integration (AniList + AllAnime)

**Users are responsible for complying with their local laws and the terms of service of any third-party APIs used.** The maintainers do not host or stream any content. All streaming is performed via third-party APIs and the user is responsible for verifying they have the right to access such content in their jurisdiction.

---

<div align="center">

**Built with ❤️ on Cloudflare Workers Free tier**

[Report Bug](../../issues) · [Request Feature](../../issues) · [⬆ Back to Top](#-xan-hono)

</div>
