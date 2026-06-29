import { formatPercent } from "../lib/format";
import { Badge } from "./ui";

/** Colored percentage badge for a price change (green up / red down). */
export function ChangeBadge({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-sm text-content-muted">—</span>;
  }
  return (
    <Badge tone={value >= 0 ? "positive" : "negative"}>
      {formatPercent(value)}
    </Badge>
  );
}
