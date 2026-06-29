import { Button } from "./ui";

export interface RefreshControlsProps {
  refreshing: boolean;
  autoRefresh: boolean;
  onRefresh: () => void;
  onToggleAuto: () => void;
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

/** Manual refresh button plus an auto-refresh toggle. */
export function RefreshControls({
  refreshing,
  autoRefresh,
  onRefresh,
  onToggleAuto,
}: RefreshControlsProps) {
  return (
    <>
      <Button onClick={onRefresh} disabled={refreshing}>
        <RefreshIcon spinning={refreshing} />
        {refreshing ? "Refreshing…" : "Refresh"}
      </Button>
      <Button
        active={autoRefresh}
        aria-pressed={autoRefresh}
        onClick={onToggleAuto}
      >
        Auto {autoRefresh ? "on" : "off"}
      </Button>
    </>
  );
}
