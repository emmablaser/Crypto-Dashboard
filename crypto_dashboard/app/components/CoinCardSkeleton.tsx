import { cardStyles } from "./ui";

/** Placeholder shown in place of a CoinCard while market data is loading. */
export function CoinCardSkeleton() {
  return (
    <div className={`${cardStyles()} animate-pulse p-5`} aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-surface-muted" />
        <div className="space-y-2">
          <div className="h-3.5 w-24 rounded bg-surface-muted" />
          <div className="h-3 w-12 rounded bg-surface-muted" />
        </div>
      </div>
      <div className="mt-5 space-y-3">
        <div className="h-5 w-full rounded bg-surface-muted" />
        <div className="h-4 w-2/3 rounded bg-surface-muted" />
      </div>
      <div className="mt-4 h-3 w-1/3 rounded bg-surface-muted" />
    </div>
  );
}
