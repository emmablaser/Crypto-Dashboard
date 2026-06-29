import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary:
    "border border-border bg-surface text-content shadow-sm hover:bg-surface-muted",
  ghost: "text-content-muted hover:bg-surface-muted",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
};

export function Button({
  variant = "secondary",
  size = "md",
  active = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        BASE,
        SIZES[size],
        // When `active`, render a selected/toggled treatment regardless of
        // the base variant.
        active ? VARIANTS.primary : VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
