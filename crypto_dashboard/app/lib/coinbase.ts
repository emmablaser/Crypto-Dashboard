/**
 * Server-side Coinbase API client.
 *
 * These functions run inside React Router (Remix) loaders, on the server, so
 * they act as the dashboard's backend data layer. The browser never talks to
 * Coinbase directly — it only receives the JSON our loaders return.
 *
 * Two public, key-free Coinbase APIs are used:
 *   - api.coinbase.com/v2          → simple exchange rates
 *   - api.exchange.coinbase.com    → product stats & historical candles
 *
 * Responses are cached in-memory for a short window to stay within Coinbase's
 * rate limits.
 */

const EXCHANGE = "https://api.exchange.coinbase.com";

/**
 * Curated set of major assets traded against USD on Coinbase. Coinbase doesn't
 * return human-readable names from its stats endpoints, so we keep the display
 * names here. Any symbol whose product is unavailable is skipped gracefully.
 */
const CURATED: { symbol: string; name: string }[] = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "LINK", name: "Chainlink" },
  { symbol: "AVAX", name: "Avalanche" },
  { symbol: "BCH", name: "Bitcoin Cash" },
  { symbol: "LTC", name: "Litecoin" },
  { symbol: "DOT", name: "Polkadot" },
  { symbol: "SHIB", name: "Shiba Inu" },
  { symbol: "UNI", name: "Uniswap" },
  { symbol: "XLM", name: "Stellar" },
  { symbol: "ATOM", name: "Cosmos" },
  { symbol: "ETC", name: "Ethereum Classic" },
  { symbol: "AAVE", name: "Aave" },
  { symbol: "FIL", name: "Filecoin" },
  { symbol: "ALGO", name: "Algorand" },
  { symbol: "APT", name: "Aptos" },
  { symbol: "ARB", name: "Arbitrum" },
  { symbol: "OP", name: "Optimism" },
  { symbol: "NEAR", name: "NEAR Protocol" },
  { symbol: "GRT", name: "The Graph" },
  { symbol: "MKR", name: "Maker" },
  { symbol: "CRV", name: "Curve DAO" },
  { symbol: "SAND", name: "The Sandbox" },
  { symbol: "MANA", name: "Decentraland" },
  { symbol: "AXS", name: "Axie Infinity" },
];

const NAME_BY_SYMBOL = new Map(CURATED.map((c) => [c.symbol, c.name]));

export interface Coin {
  /** Base asset symbol, e.g. "BTC". */
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  /** 24h traded volume converted to USD. */
  total_volume: number;
  price_change_percentage_24h: number | null;
}

interface CacheEntry {
  expires: number;
  data: unknown;
}

const cache = new Map<string, CacheEntry>();

async function cachedFetch<T>(url: string, ttlMs = 60_000): Promise<T> {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) {
    return hit.data as T;
  }

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      // Coinbase's Exchange API rejects requests without a User-Agent.
      "user-agent": "crypto-dashboard/1.0",
    },
  });

  if (!res.ok) {
    throw new Response(`Coinbase request failed (${res.status})`, {
      status: res.status === 429 ? 429 : 502,
    });
  }

  const data = (await res.json()) as T;
  cache.set(url, { expires: Date.now() + ttlMs, data });
  return data;
}

interface ProductStats {
  open: string;
  last: string;
  volume: string;
}

async function getProductStats(symbol: string): Promise<Coin | null> {
  try {
    const stats = await cachedFetch<ProductStats>(
      `${EXCHANGE}/products/${symbol}-USD/stats`,
      // Short TTL so manual/auto refresh returns near real-time rates while
      // still shielding Coinbase from bursts of identical requests.
      15_000,
    );
    const last = Number(stats.last);
    const open = Number(stats.open);
    if (!Number.isFinite(last) || last <= 0) return null;

    const change =
      Number.isFinite(open) && open > 0 ? ((last - open) / open) * 100 : null;

    return {
      id: symbol,
      symbol,
      name: NAME_BY_SYMBOL.get(symbol) ?? symbol,
      current_price: last,
      total_volume: Number(stats.volume) * last,
      price_change_percentage_24h: change,
    };
  } catch {
    // Product may be delisted/unavailable — skip it rather than failing the
    // whole dashboard.
    return null;
  }
}

/**
 * Fetches 24h stats for the curated coin list and returns them sorted by USD
 * volume (highest first), so the most actively traded markets lead the table.
 */
export async function getMarkets(): Promise<Coin[]> {
  const results = await Promise.all(
    CURATED.map((c) => getProductStats(c.symbol)),
  );
  const coins = results.filter((c): c is Coin => c !== null);
  // A few products may fail individually (and get skipped), but if none
  // loaded at all, Coinbase is unreachable/down — surface it as an error.
  if (coins.length === 0) {
    throw new Response("Unable to load market data from Coinbase", {
      status: 502,
    });
  }
  return coins.sort((a, b) => b.total_volume - a.total_volume);
}
