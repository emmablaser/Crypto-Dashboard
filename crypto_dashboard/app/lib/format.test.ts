import { describe, expect, it } from "vitest";
import { formatBtc, formatCompact, formatCurrency, formatPercent } from "./format";

describe("formatCurrency", () => {
  it("formats values >= 1 with up to 2 fraction digits", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency(2)).toBe("$2.00");
    expect(formatCurrency(1999.999)).toBe("$2,000.00");
  });

  it("uses extra precision for sub-dollar values", () => {
    expect(formatCurrency(0.123456789)).toBe("$0.123457");
  });

  it("respects a custom max fraction digit count", () => {
    expect(formatCurrency(1234.5678, 0)).toBe("$1,235");
  });

  it("returns an em dash for nullish or NaN input", () => {
    expect(formatCurrency(NaN)).toBe("—");
    expect(formatCurrency(undefined as unknown as number)).toBe("—");
    expect(formatCurrency(null as unknown as number)).toBe("—");
  });
});

describe("formatCompact", () => {
  it("abbreviates large numbers", () => {
    expect(formatCompact(1_500_000)).toBe("1.5M");
    expect(formatCompact(2_300)).toBe("2.3K");
    expect(formatCompact(1_200_000_000)).toBe("1.2B");
  });

  it("returns an em dash for NaN", () => {
    expect(formatCompact(NaN)).toBe("—");
  });
});

describe("formatBtc", () => {
  it("prefixes with the bitcoin symbol", () => {
    expect(formatBtc(1.23456789)).toBe("₿1.2346");
  });

  it("uses more precision for tiny fractions", () => {
    expect(formatBtc(0.000123456789)).toBe("₿0.00012346");
  });

  it("returns an em dash for NaN", () => {
    expect(formatBtc(NaN)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("adds a plus sign for non-negative values", () => {
    expect(formatPercent(0)).toBe("+0.00%");
    expect(formatPercent(3.456)).toBe("+3.46%");
  });

  it("keeps the minus sign for negative values", () => {
    expect(formatPercent(-2.1)).toBe("-2.10%");
  });

  it("returns an em dash for null or NaN", () => {
    expect(formatPercent(null)).toBe("—");
    expect(formatPercent(NaN)).toBe("—");
  });
});
