import { Button } from "./ui";

export interface MenuOption<T> {
  value: T;
  label: string;
}

interface MenuProps<T> {
  /** Optional leading label, e.g. "Sort by". */
  label?: string;
  options: MenuOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A horizontal group of toggle buttons where exactly one option is active. */
export function Menu<T extends string | number>({
  label,
  options,
  value,
  onChange,
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
          size="sm"
          active={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
