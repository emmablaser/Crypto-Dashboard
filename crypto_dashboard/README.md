# Crypto Dashboard

A server-rendered dashboard showing live Coinbase market data as a responsive
grid of coin cards (USD + BTC price, 24h change, volume), with filtering,
sorting, drag-to-reorder, manual/auto refresh, light/dark themes, and a
shared-password gate.

**Stack:** React Router 8 (framework mode / SSR) · React 19 · TypeScript ·
Tailwind CSS v4 · Vite 8 · Vitest. Data from the public Coinbase Exchange API.

## Setup

```bash
npm install
```

Create a `.env` in the project root with two variables:

- `SITE_PASSWORD_HASH` — a salted **scrypt** verifier for the shared password
  (the password itself is never stored). Generate it with `npm run hash-password`,
  then paste the printed line into `.env`.
- `SESSION_SECRET` — a random string to sign the session cookie:
  `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

Then start the dev server:

```bash
npm run dev
```

Visit `http://localhost:5173` (Vite picks the next free port if it's taken) and
enter the shared password — **`crypto-dashboard`** — to reach the dashboard.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` / `npm start` | Production build / serve |
| `npm run hash-password` | Generate a `SITE_PASSWORD_HASH` (offline) |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | Route types + `tsc` |

## Decisions & trade-offs

- **React Router 8 instead of Remix v2.** The "Remix + React" stack is exactly
  what runs here — Remix was merged into React Router v7+, and framework mode is
  the official continuation of Remix (same `loader`/`action`/SSR/`ErrorBoundary`
  model). I chose the latest, actively maintained version over the now-legacy
  `@remix-run/*` v2 packages. *Trade-off:* dependencies are named `react-router` /
  `@react-router/*`, so a strict name-based check for a literal `remix` package
  won't find one — the framework behavior is unchanged. See [`PRD.md`](./PRD.md).
- **Shared password, stored as a hash, no accounts.** One site-wide password
  (no per-user logins). It's kept as a salted scrypt verifier so no plaintext
  lives in the repo or `.env`; a separate `npm run hash-password` tool produces
  it. *Trade-off:* no per-user identity or revocation, and rotating the password
  logs everyone out. See [`PRD-AUTH.md`](./PRD-AUTH.md) and
  [`PRD-PASSWORD-HASHING.md`](./PRD-PASSWORD-HASHING.md).
- **Server-side data fetching + in-memory cache.** The browser never calls
  Coinbase directly; loaders fetch on the server and a short-TTL cache absorbs
  request bursts and rate limits.
- **Drag order is in-session only.** Card order is personalizable by dragging but
  deliberately resets on reload/refresh — a UX choice, not a limitation.
- **Theme isn't persisted.** It follows the system preference on each load (with
  a pre-paint script to avoid a flash of the wrong theme).
- **Monogram icons, not logos.** Coinbase provides no logos, so cards use
  deterministic colored monograms — no external icon dependency.

## Notes

Portfolio/interview project. Market data is public and for informational
purposes only — not financial advice. Full spec and a section-by-section
breakdown live in [`PRD.md`](./PRD.md).
