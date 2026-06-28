# Contributing to XANCLD

Thanks for your interest in contributing! This guide will help you get started.

## 🚀 Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/smithP2007/XANCLD.git
   cd XANCLD
   ```
3. **Install** dependencies:
   ```bash
   bun install
   ```
4. **Start** the dev server:
   ```bash
   bun run dev
   ```

## 🛠️ Development Setup

### Running both frontend and API locally

The app has two parts:
- **Frontend** (Vite dev server, port 5173) — the React SPA
- **API** (Wrangler dev, port 3003) — the Hono CORS proxy

Vite's dev config proxies `/api/*` requests to port 3003 automatically.

```bash
# Terminal 1: Start the API
bunx wrangler dev --port 3003

# Terminal 2: Start the frontend
bun run dev
```

### Building for production

```bash
bun run build        # Build the frontend to dist/
bun run deploy       # Build + deploy to Cloudflare Workers
```

## 📝 Code Style

- **TypeScript** throughout with strict typing
- **ES6+** import/export syntax
- Use **named exports** for components and utilities
- Prefer **functional components** with hooks
- Use **Tailwind CSS** utility classes — no custom CSS unless necessary
- Follow the existing file structure:
  - `src/worker/` — Hono worker (server-side only)
  - `src/web/components/` — Reusable React components
  - `src/web/routes/` — Page components
  - `src/web/lib/` — API clients and utilities
  - `src/web/hooks/` — Custom React hooks

## 🎨 Design Guidelines

- Use the XAN design tokens (crimson `#e94560`, violet `#a855f7`)
- Apply glassmorphism (`.glass` class) for cards and panels
- Add hover-lift effects on interactive elements
- Use `animate-fade-in-up` for section entrance animations
- Ensure dark/light theme compatibility (use `text-foreground`, `text-muted-foreground`, not hardcoded colors)
- Test on mobile (375px), tablet (768px), and desktop (1440px) widths

## 🧩 Adding a New Page

1. Create a new file in `src/web/routes/` (e.g., `Profile.tsx`)
2. Add the route in `src/web/main.tsx`:
   ```tsx
   <Route path="/profile" element={<Profile />} />
   ```
3. Add a nav link in `src/web/components/Navbar.tsx` if needed

## 🔌 Adding a New API Source

1. Add the host to the `ALLOWED_HOSTS` array in `src/worker/index.ts`
2. Add extraction logic in `src/web/lib/allanime.ts` if the source needs special handling

## 📦 Committing

- Use clear, descriptive commit messages
- Reference issues with `#123` syntax
- Keep commits focused — one feature/fix per commit

```bash
git add .
git commit -m "feat: add anime recommendations section to detail page"
git push origin feature/your-branch
```

## 🐛 Reporting Bugs

When reporting a bug, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and OS
- Screenshots (if applicable)

## 💡 Suggesting Features

Feature requests are welcome! Please:
- Check existing issues first
- Describe the use case
- Provide mockups or examples if possible

## ✅ Pull Request Checklist

- [ ] Code follows the style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] No new warnings or errors
- [ ] Tested in both dark and light themes
- [ ] Tested on mobile and desktop widths

Thank you for contributing! 🎉
