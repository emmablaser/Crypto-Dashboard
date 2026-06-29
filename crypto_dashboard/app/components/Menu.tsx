import { Button } from "./ui";

export interface MenuOption<T> {
  value: T;
  label: string;
}

export interface MenuProps<T> {
  /** Optional leading label, e.g. "Sort by". */
  label?: string;
  options: MenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}

/**
 * A horizontal group of toggle buttons where exactly one option is active.
 * Reused for the sort selector and the chart time-range selector.
 */
export function Menu<T extends string | number>({
  label,
  options,
  value,
  onChange,
  size = "sm",
}: MenuProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-xs font-medium uppercase tracking-wide text-content-muted">
          {label}
        </span>
      )}
      {options.map((opt) => (
        <Button
          key={String(opt.value)}
          variant="ghost"
          size={size}
          active={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
