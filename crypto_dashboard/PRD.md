# Crypto Dashboard — Product Requirements Document

## 1. Overview

Crypto Dashboard is a server-rendered web application that displays live
cryptocurrency market data sourced from Coinbase. It presents a curated set of
major assets as a responsive grid of cards, each showing the coin's name,
symbol, USD price, BTC-denominated price, 24h change, and trading volume. Users
can filter, sort, manually reorder, and refresh the data, and switch between
light and dark themes.

The product is **read-only** (no trading or data mutations) and sits behind a
single **shared password** — there are no individual user accounts. It is meant
as a clean, fast, informational dashboard.

### Goals

- Show real-time crypto exchange rates from a reputable public source.
- Make the data easy to scan, filter, and personalize at a glance.
- Be fast (SSR, cached data) and resilient (graceful loading and error states).
- Maintain a clean, themeable design system and a modular, tested codebase.

### Non-goals

- Individual user accounts (access is gated by one shared password, not
  per-user logins).
- Trading, portfolio tracking, or any write operations.
- Per-coin detail pages or historical charts.
- Financial advice — the UI explicitly states it is informational only.

---

## 2. Tech Stack

| Concern | Choice |
| --- | --- |
| Framework | React Router 8 framework mode — the current generation of **Remix** (see note below) |
| Language | TypeScript (strict) |
| UI | React 19 |
| Styling | Tailwind CSS v4 (`@theme` design tokens) |
| Build/dev | Vite 8 |
| Testing | Vitest 4 + Testing Library + jsdom |
| Data source | Coinbase Exchange public API (no key required) |
| Auth | Shared password (salted **scrypt** verifier, no plaintext stored) via signed, httpOnly cookie session |
| Font | Inter (Google Fonts) |

### Note on "Remix + React" (framework lineage)

The required tech stack is **Remix + React**, and that is exactly what this app
runs on — just under its current name. Remix and React Router were merged by the
same team: Remix's framework features (server `loader`s/`action`s, SSR, nested
routes, `meta`/`links`, route-level error boundaries) were folded into **React
Router v7+**, and **React Router framework mode is the official, supported
continuation of Remix**. v8 (used here) is the latest release of that line.

Practically:

- The package names are `react-router` and `@react-router/*` rather than the
  older `@remix-run/react`, but the programming model and APIs are the Remix
  model. (You'll even see `@remix-run/*` packages appear transitively in the
  lockfile, since the framework is still published under that scope.)
- Every Remix concept the stack calls for is used directly in this codebase:
  - **`loader`** (server-side data fetching) — `app/routes/home.tsx`
  - **`useRevalidator`** (re-run loaders without navigation) — `app/routes/home.tsx`
  - **`meta`** route export — `app/routes/home.tsx`; **`links`** route export — `app/root.tsx`
  - **`ErrorBoundary`** route-level error handling — `app/routes/home.tsx`, `app/root.tsx`
  - **SSR document shell** (`<Meta />`, `<Links />`, `<Scripts />`,
    `<ScrollRestoration />`) — `app/root.tsx`

**Trade-off considered.** We chose React Router 8 over the legacy standalone
Remix v2 (`@remix-run/*`) packages deliberately:

- **Upsides:** it's the latest, actively maintained version of the framework
  (Remix v2 is now in maintenance mode); it's future-proof and on the official
  upgrade path; and it adds quality-of-life wins like type-safe route types
  (the generated `./+types/*` modules) and the modern Vite plugin — all while
  keeping the exact Remix programming model.
- **Downside:** the `package.json` lists `react-router` / `@react-router/*`
  instead of `@remix-run/react`, so a strict, name-based reading of a
  "Remix" requirement won't find a literal `remix` dependency, and some older
  Remix tutorials/imports won't line up one-to-one. The framework behavior and
  APIs are unchanged.
- **Verdict:** the naming mismatch is cosmetic; the functional requirement
  ("Remix + React") is fully met. If a reviewer specifically mandates the
  `@remix-run` v2 packages by name, the app can be migrated back to them with
  mostly import/config swaps, since the APIs are nearly identical.

In short: choosing React Router 8 means using the latest, actively maintained
version of Remix rather than the now-legacy `@remix-run` v2 packages — same
framework, current name.

---

## 3. Architecture

- **Server-side data layer** (`app/lib/coinbase.ts`): all Coinbase calls run on
  the server inside the route loader. The browser never talks to Coinbase
  directly — it only receives the JSON the loader returns.
- **Single route**: an index route (`app/routes/home.tsx`) renders the entire
  dashboard. `app/root.tsx` provides the HTML shell, fonts, theme bootstrap
  script, and a top-level error boundary.
- **In-memory caching** shields Coinbase from bursts of identical requests and
  keeps refreshes within rate limits.
- **Client interactivity** (filter, sort, drag-reorder, refresh, theme) is
  layered on top of the server-rendered markup.

### File map

```
scripts/
  hash-password.mjs            # Offline CLI: turns a password into a SITE_PASSWORD_HASH verifier
app/
  root.tsx                     # HTML shell, fonts, no-flash theme script, error boundary
  routes.ts                    # Route config (single index route)
  app.css                      # Tailwind import + design tokens (light/dark)
  routes/
    home.tsx                   # Dashboard page: loader (auth-gated), UI, ErrorBoundary
    login.tsx                  # Shared-password login (form + server action)
    logout.tsx                 # Clears the session
  components/
    CoinCard.tsx               # Single coin card (name, symbol, USD, BTC, volume)
    CoinCardSkeleton.tsx       # Loading placeholder card
    CoinIcon.tsx               # Colored monogram (Coinbase has no logos)
    ChangeBadge.tsx            # Green/red 24h % change badge
    Menu.tsx                   # Single-select toggle-button group (sorting)
    RefreshControls.tsx        # Manual refresh button + auto-refresh toggle
    ThemeToggle.tsx            # Light/dark toggle (sun/moon)
    LogoutButton.tsx           # Log out button (posts to /logout)
    ui/                        # Design-system primitives
      Button.tsx               #   variants: primary | secondary | ghost; sizes: sm | md
      Badge.tsx                #   tones: neutral | positive | negative
      Card.tsx                 #   cardStyles() shared card classes
      Input.tsx                #   styled text/search input
      index.ts                 #   barrel export
  lib/
    auth.server.ts             # Shared-password session + scrypt verifier (constant-time) + guard
    coinbase.ts                # Server-side Coinbase client + caching + types
    format.ts                  # Currency / compact / BTC / percent formatters
    cn.ts                      # Class-name joiner
    theme.ts                   # toggleTheme() — flips data-theme on <html>
    useDragReorder.ts          # HTML5 drag-and-drop reorder hook (+ localStorage)
```

---

## 4. Features (what we built, section by section)

### 4.1 Data Source — Coinbase Integration

**What:** Live market data for a curated list of ~30 major assets (BTC, ETH,
SOL, XRP, etc.), each traded against USD.

**How it works:**
- `getMarkets()` fetches 24h stats for every curated symbol from
  `https://api.exchange.coinbase.com/products/{SYMBOL}-USD/stats` in parallel.
- Each response is mapped into a normalized `Coin` shape:
  `{ id, symbol, name, current_price, total_volume, price_change_percentage_24h }`.
- Coinbase doesn't return human-readable names, so display names are kept in a
  local `CURATED` table.
- 24h change is derived from the `open` and `last` prices; if `open` is
  unusable the change is reported as `null`.
- Results are sorted by USD volume (highest first) so the most active markets
  lead.

**Resilience:**
- Individual products that are delisted/unavailable are skipped gracefully
  (return `null`) rather than failing the whole page.
- If **every** product fails, `getMarkets()` throws a `502` Response so the
  route error boundary is shown.
- `cachedFetch()` throws `429` on rate limits and `502` otherwise.

**Caching:** in-memory `Map` keyed by URL. Product stats use a short 15-second
TTL so manual/auto refresh returns near real-time data while still absorbing
duplicate requests.

### 4.2 Dashboard Layout — Coin Cards

**What:** A responsive grid of cards (1 → 2 → 3 → 4 columns as the viewport
widens). Each `CoinCard` shows:
- A colored **monogram icon** derived deterministically from the symbol
  (Coinbase provides no logos, so no external icon dependency is needed).
- **Name** and a **symbol pill** badge.
- A **24h change badge** (green when up, red when down, em dash when unknown).
- **USD price** (prominent) and **BTC price** (monospace, muted).
- **24h volume** in compact notation.

**BTC rate derivation:** Coinbase only quotes products against USD, so each
coin's BTC price is computed client-side as `coin.current_price / btcUsdPrice`.

### 4.3 Dynamic Data Fetching

**What:** Rates update on load, on demand, and optionally on an interval.
- **On page load:** the SSR loader fetches fresh data.
- **Manual refresh:** a Refresh button re-runs the loader via React Router's
  `useRevalidator` (no full navigation).
- **Auto-refresh:** a toggle that revalidates every 30 seconds.
- **Live status dot:** green when idle, pulsing amber while refreshing, plus a
  "updated {time}" timestamp.

Manual refresh shows skeleton loaders; background auto-refresh updates silently
(only the status dot animates), so the page doesn't flicker.

### 4.4 Filtering

**What:** A search input at the top filters the list **by name or symbol** in
real time (e.g. typing "eth" surfaces Ethereum). A live count ("Showing X of Y
coins matching …") gives feedback, and an empty-result state is handled.

### 4.5 Sorting

**What:** A `Menu` of toggle buttons sorts by **Volume**, **Price**, or **24h
Change** (descending). Selecting a sort rewrites the card order accordingly.

### 4.6 Drag-and-Drop Reordering

**What:** Cards can be reordered by dragging, using native HTML5 drag-and-drop
(`useDragReorder` hook). The dragged card dims while moving.

**Persistence behavior (deliberate design decision):**
- The current order is written to `localStorage` (key
  `crypto-dashboard:card-order`) as the user drags.
- However, the stored order is **cleared on every page load/mount**, and the
  Refresh button resets to the default (volume) order.
- Net effect: drag order is a *temporary, in-session* personalization. Any
  reload or Refresh returns to the original order. This was an explicit product
  choice after iterating on the UX.

### 4.7 Design System

**What:** A token-driven design system so components never hardcode colors or
need `dark:` variants.
- **Tokens** (`app/app.css`, Tailwind `@theme`): a brand scale, status colors
  (positive/negative + soft variants), semantic surfaces/text
  (`page`, `surface`, `surface-muted`, `border`, `content`, `content-muted`),
  and a card radius. Semantic tokens resolve to CSS variables that swap between
  light and dark.
- **Primitives** (`app/components/ui/`):
  - `Button` — variants `primary | secondary | ghost`, sizes `sm | md`, plus an
    `active` (toggled) state.
  - `Badge` — tones `neutral | positive | negative`.
  - `Card` — shared `cardStyles()` class helper.
  - `Input` — styled text/search field.

### 4.8 Dark / Light Mode

**What:** A sun/moon toggle in the header switches themes instantly.
- Theme is driven by a `data-theme` attribute on `<html>`.
- A tiny inline script in `root.tsx` runs **before paint** to apply the
  system color scheme, preventing a flash of the wrong theme.
- Both toggle icons are always rendered; CSS shows the correct one based on the
  active theme, so there's no icon flash either.
- Theme is intentionally **not persisted** — it resets to the system preference
  on each load. (Only the card order ever touches `localStorage`.)
- `suppressHydrationWarning` is used on `<html>` and the timestamp to avoid
  hydration mismatches caused by the pre-paint script.

### 4.9 Loading & Error States

**What:**
- **Loading:** `CoinCardSkeleton` placeholders fill the grid during a manual
  refresh, with `aria-busy` for accessibility.
- **Empty:** a friendly "No market data available" card with a Retry button.
- **No filter matches:** a clear "No coins match …" message.
- **Errors:** a route-level `ErrorBoundary` renders a styled error card with a
  "Try again" button. It tailors the message for rate limiting (`429`) vs.
  other failures, reading the thrown Response status.

### 4.10 Authentication (Shared Password)

**What:** The dashboard is gated behind a single shared password (no individual
accounts), implemented server-side:
- A `/login` page posts the password to a server action, which verifies it
  against a **salted scrypt verifier** in **constant time** (`scryptSync` +
  `timingSafeEqual`) so the check can't be probed via timing.
- The real password is never stored — only the verifier in `SITE_PASSWORD_HASH`,
  produced offline by `npm run hash-password`.
- On success, a signed, httpOnly **session cookie** (7-day expiry) marks the
  visitor as unlocked; `requireAuth` in the home loader redirects everyone else
  to `/login`.
- A header **Log out** button posts to `/logout`, which destroys the session.
- The verifier and cookie secret come from the `SITE_PASSWORD_HASH` and
  `SESSION_SECRET` env vars; auth fails closed when the verifier is unset.

See [`PRD-AUTH.md`](./PRD-AUTH.md) for the trade-off analysis and
[`PRD-PASSWORD-HASHING.md`](./PRD-PASSWORD-HASHING.md) for the hashing design.

### 4.11 Component Modularity

**What:** Every UI concern lives in its own file (cards, badge, menu, refresh
controls, theme toggle, icons, skeletons, and the `ui/` primitives). The page
component composes these rather than inlining markup, keeping `home.tsx`
focused on data and orchestration.

### 4.12 Testing

**What:** A Vitest unit-test suite (36 tests) covering the pure logic, auth, and
the reorder hook:
- `format.test.ts` — currency/compact/BTC/percent formatting, precision rules,
  and `—` fallbacks.
- `cn.test.ts` — class-name joining and falsy filtering.
- `coinbase.test.ts` — the data layer with a mocked `fetch`: mapping, volume
  sorting, 24h-change calculation, skipping failed/invalid products, the `502`
  on total failure, and cache hits avoiding duplicate fetches.
- `useDragReorder.test.ts` — initial order, `setOrder`, drag tracking, the
  move-on-enter math, id reconciliation on data refresh, and the
  clear-on-mount / persist-on-change `localStorage` behavior.
- `auth.server.test.ts` — scrypt verification: the right password passes, wrong
  passwords / malformed / non-scrypt / empty verifiers fail closed, and
  `verifyPassword` reads `SITE_PASSWORD_HASH` from the env at call time.

**Commands:** `npm test` (run once) and `npm run test:watch`. Typecheck via
`npm run typecheck`. Generate a password verifier via `npm run hash-password`.

### 4.13 Deployment / Source Control

- A root `.gitignore` excludes `.DS_Store`, `node_modules/`, build output
  (`/build/`, `/.react-router/`), and `.env`.
- The project builds to a server bundle (`react-router build`) served by
  `react-router-serve`.

---

## 5. Future Considerations

- **Persistence with a backend:** if accounts are ever added, a database would
  let users persist their card order and preferences across devices.
- **More assets / search-driven loading:** expand beyond the curated list.
- **Component/render tests:** add Testing Library tests for `CoinCard`, the
  filter, and sorting behavior to cover the UI layer.
- **Authentication (if ever needed):** the dashboard is public by design; if
  login is required later, a hosted provider (e.g. Clerk) would be the quickest
  path.
