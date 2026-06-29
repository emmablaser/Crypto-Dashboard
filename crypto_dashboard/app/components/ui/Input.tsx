import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "rounded-lg border border-border bg-surface px-4 py-2 text-sm text-content shadow-sm outline-none placeholder:text-content-muted focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30",
        className,
      )}
      {...props}
    />
  );
}
