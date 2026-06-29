interface CoinIconProps {
  symbol: string;
  size?: number;
}

// Deterministic palette so each symbol always renders the same color.
const COLORS = [
  "#f7931a",
  "#627eea",
  "#16c784",
  "#ea3943",
  "#8247e5",
  "#2775ca",
  "#e84142",
  "#345d9d",
  "#0033ad",
  "#ff007a",
];

function colorFor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

/**
 * Coinbase's API doesn't return coin logos, so we render a colored monogram
 * derived from the symbol instead of pulling in an external icon dependency.
 */
export function CoinIcon({ symbol, size = 28 }: CoinIconProps) {
  const label = symbol.slice(0, 4).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: colorFor(symbol),
        fontSize: Math.max(9, size * 0.34),
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold leading-none text-white"
    >
      {label.length > 3 ? label.slice(0, 3) : label}
    </span>
  );
}
