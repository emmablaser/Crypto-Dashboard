import { cn } from "../../lib/cn";

/**
 * Shared card surface styling. Returned as a class string so it can be applied
 * to any element (e.g. an `<article>` card).
 */
export function cardStyles({ interactive = false } = {}): string {
  return cn(
    "rounded-card border border-border bg-surface shadow-sm",
    interactive &&
      "transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md",
  );
}
