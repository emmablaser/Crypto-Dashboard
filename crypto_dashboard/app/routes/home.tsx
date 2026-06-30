import { useEffect, useMemo, useState } from "react";
import { isRouteErrorResponse, useRevalidator } from "react-router";
import type { Route } from "./+types/home";
import { getMarkets, type Coin } from "../lib/coinbase";
import { requireAuth } from "../lib/auth.server";
import { useDragReorder } from "../lib/useDragReorder";
import { CoinCard } from "../components/CoinCard";
import { LogoutButton } from "../components/LogoutButton";
import { CoinCardSkeleton } from "../components/CoinCardSkeleton";
import { Menu, type MenuOption } from "../components/Menu";
import { RefreshControls } from "../components/RefreshControls";
import { ThemeToggle } from "../components/ThemeToggle";
import { Button, cardStyles, Input } from "../components/ui";

const GRID_CLASS =
  "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Crypto Dashboard" },
    {
      name: "description",
      content: "Live cryptocurrency prices and charts from Coinbase.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const coins = await getMarkets();
  return { coins, updatedAt: new Date().toISOString() };
}

type SortKey =
  | "current_price"
  | "price_change_percentage_24h"
  | "total_volume";

const AUTO_REFRESH_MS = 30_000;

const SORT_OPTIONS: MenuOption<SortKey>[] = [
  { value: "total_volume", label: "Volume" },
  { value: "current_price", label: "Price" },
  { value: "price_change_percentage_24h", label: "24h Change" },
];

function sortIds(coins: Coin[], key: SortKey): string[] {
  return [...coins]
    .sort((a, b) => ((b[key] ?? 0) as number) - ((a[key] ?? 0) as number))
    .map((c) => c.id);
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { coins, updatedAt } = loaderData;
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_volume");
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Re-runs the route loader to pull fresh Coinbase rates without a full
  // navigation, powering both the manual button and auto-refresh.
  const revalidator = useRevalidator();
  const refreshing = revalidator.state === "loading";

  // Only a user-initiated refresh shows the loading skeleton; background
  // auto-refresh updates silently (just the status dot).
  const [manualBusy, setManualBusy] = useState(false);
  useEffect(() => {
    if (revalidator.state === "idle" && manualBusy) setManualBusy(false);
  }, [revalidator.state, manualBusy]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => revalidator.revalidate(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, revalidator]);

  const ids = useMemo(() => coins.map((c) => c.id), [coins]);
  const reorder = useDragReorder(ids, "crypto-dashboard:card-order");

  const coinById = useMemo(
    () => new Map(coins.map((c) => [c.id, c])),
    [coins],
  );

  // Exchange rate to BTC is derived from each coin's USD price relative to
  // Bitcoin's USD price (Coinbase only quotes products against USD).
  const btcUsd = useMemo(
    () => coins.find((c) => c.symbol === "BTC")?.current_price ?? 0,
    [coins],
  );

  function applySort(key: SortKey) {
    setSortKey(key);
    reorder.setOrder(sortIds(coins, key));
  }

  // Refresh resets the cards to the original (default volume) order, shows the
  // loading skeleton, and pulls fresh data.
  function handleRefresh() {
    setSortKey("total_volume");
    reorder.setOrder(sortIds(coins, "total_volume"));
    setManualBusy(true);
    revalidator.revalidate();
  }

  const displayed = useMemo(() => {
    const ordered = reorder.orderIds
      .map((id) => coinById.get(id))
      .filter((c): c is Coin => c != null);
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q),
    );
  }, [reorder.orderIds, coinById, query]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-content sm:text-3xl">
            Crypto Dashboard
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-content-muted">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                refreshing ? "animate-pulse bg-amber-400" : "bg-positive"
              }`}
            />
            Live Coinbase market data · updated{" "}
            <span suppressHydrationWarning>
              {new Date(updatedAt).toLocaleTimeString()}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or symbol…"
            aria-label="Filter coins by name or symbol"
            className="w-56 sm:w-64"
          />
          <RefreshControls
            refreshing={refreshing}
            autoRefresh={autoRefresh}
            onRefresh={handleRefresh}
            onToggleAuto={() => setAutoRefresh((v) => !v)}
          />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <div className="mb-2">
        <Menu
          label="Sort by"
          options={SORT_OPTIONS}
          value={sortKey}
          onChange={applySort}
        />
      </div>
      <p className="mb-6 text-xs text-content-muted">
        {query.trim()
          ? `Showing ${displayed.length} of ${coins.length} coins matching “${query.trim()}”.`
          : "Tip: drag a card to reorder. Reloading the page or hitting Refresh restores the original order."}
      </p>

      {manualBusy ? (
        <section className={GRID_CLASS} aria-busy="true">
          {Array.from({ length: coins.length || 8 }).map((_, i) => (
            <CoinCardSkeleton key={i} />
          ))}
        </section>
      ) : coins.length === 0 ? (
        <div className={`${cardStyles()} px-6 py-12 text-center`}>
          <p className="text-content-muted">
            No market data is available right now.
          </p>
          <div className="mt-4">
            <Button variant="primary" onClick={handleRefresh}>
              Retry
            </Button>
          </div>
        </div>
      ) : displayed.length === 0 ? (
        <p className="py-16 text-center text-content-muted">
          No coins match “{query}”.
        </p>
      ) : (
        <section className={GRID_CLASS}>
          {displayed.map((coin) => (
            <div
              key={coin.id}
              {...reorder.getItemProps(coin.id)}
              className={`cursor-grab transition-opacity active:cursor-grabbing ${
                reorder.isDragging(coin.id) ? "opacity-40" : "opacity-100"
              }`}
            >
              <CoinCard
                coin={coin}
                btcRate={btcUsd > 0 ? coin.current_price / btcUsd : 0}
              />
            </div>
          ))}
        </section>
      )}

      <p className="mt-8 text-center text-xs text-content-muted">
        Data from Coinbase. For informational purposes only — not financial
        advice.
      </p>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const revalidator = useRevalidator();
  const retrying = revalidator.state === "loading";

  let title = "Something went wrong";
  let detail = "We couldn't load market data. Please try again.";
  if (isRouteErrorResponse(error)) {
    if (error.status === 429) {
      title = "Rate limited";
      detail =
        "Coinbase is receiving too many requests right now. Wait a moment and retry.";
    } else {
      title = `Error ${error.status}`;
      detail = error.statusText || detail;
    }
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4">
      <div className={`${cardStyles()} w-full p-8 text-center`}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-negative-soft text-negative">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-lg font-semibold text-content">{title}</h1>
        <p className="mt-2 text-sm text-content-muted">{detail}</p>
        <div className="mt-6">
          <Button
            variant="primary"
            onClick={() => revalidator.revalidate()}
            disabled={retrying}
          >
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      </div>
    </main>
  );
}
