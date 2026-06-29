export function formatCurrency(value: number, maxFractionDigits = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  const digits = value < 1 ? 6 : maxFractionDigits;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompact(value: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatBtc(value: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  // Show enough precision for tiny fractions without trailing noise.
  const digits = value >= 1 ? 4 : 8;
  return `₿${value.toLocaleString("en-US", { maximumFractionDigits: digits })}`;
}

export function formatPercent(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}
