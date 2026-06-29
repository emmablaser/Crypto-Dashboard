import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Imports a fresh copy of the module so its in-memory cache starts empty for
 * each test.
 */
async function importFresh() {
  vi.resetModules();
  return import("./coinbase");
}

function symbolFromUrl(url: string): string {
  return /products\/([A-Z0-9]+)-USD\/stats/.exec(url)?.[1] ?? "";
}

/** Builds a fetch mock that returns per-symbol stats via the supplied resolver. */
function fetchMock(
  resolve: (symbol: string) => { body?: object; status?: number },
) {
  return vi.fn(async (url: string | URL) => {
    const { body, status = 200 } = resolve(symbolFromUrl(String(url)));
    return new Response(body ? JSON.stringify(body) : "", { status });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getMarkets", () => {
  it("maps stats into coins and sorts by USD volume descending", async () => {
    const fetchFn = fetchMock((sym) => ({
      // Vary volume per symbol so ordering is observable.
      body: { open: "90", last: "100", volume: String((sym.charCodeAt(0) % 9) + 1) },
    }));
    vi.stubGlobal("fetch", fetchFn);

    const { getMarkets } = await importFresh();
    const coins = await getMarkets();

    expect(coins.length).toBeGreaterThan(0);
    // One fetch per curated product, no duplicates.
    expect(fetchFn).toHaveBeenCalledTimes(coins.length);

    for (let i = 1; i < coins.length; i++) {
      expect(coins[i - 1].total_volume).toBeGreaterThanOrEqual(
        coins[i].total_volume,
      );
    }

    const btc = coins.find((c) => c.symbol === "BTC");
    expect(btc).toBeDefined();
    expect(btc?.name).toBe("Bitcoin");
    expect(btc?.current_price).toBe(100);
    expect(btc?.id).toBe("BTC");
  });

  it("computes the 24h change from open and last", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMock(() => ({ body: { open: "100", last: "110", volume: "5" } })),
    );

    const { getMarkets } = await importFresh();
    const coins = await getMarkets();

    expect(coins[0].price_change_percentage_24h).toBeCloseTo(10, 5);
  });

  it("reports a null change when open price is unusable", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMock(() => ({ body: { open: "0", last: "110", volume: "5" } })),
    );

    const { getMarkets } = await importFresh();
    const coins = await getMarkets();

    expect(coins[0].price_change_percentage_24h).toBeNull();
  });

  it("skips products that fail or return an invalid price", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMock((sym) => {
        if (sym === "DOGE") return { status: 404 };
        if (sym === "XRP") return { body: { open: "1", last: "0", volume: "5" } };
        return { body: { open: "90", last: "100", volume: "5" } };
      }),
    );

    const { getMarkets } = await importFresh();
    const coins = await getMarkets();

    const symbols = coins.map((c) => c.symbol);
    expect(symbols).not.toContain("DOGE");
    expect(symbols).not.toContain("XRP");
    expect(symbols).toContain("BTC");
  });

  it("throws a 502 Response when every product fails", async () => {
    vi.stubGlobal(
      "fetch",
      fetchMock(() => ({ status: 500 })),
    );

    const { getMarkets } = await importFresh();

    let caught: unknown;
    try {
      await getMarkets();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Response);
    expect((caught as Response).status).toBe(502);
  });

  it("serves repeat calls from cache without re-fetching", async () => {
    const fetchFn = fetchMock(() => ({
      body: { open: "90", last: "100", volume: "5" },
    }));
    vi.stubGlobal("fetch", fetchFn);

    const { getMarkets } = await importFresh();
    const first = await getMarkets();
    await getMarkets();

    // Second call is fully cached, so the total fetch count stays at one per
    // product.
    expect(fetchFn).toHaveBeenCalledTimes(first.length);
  });
});
