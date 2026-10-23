import type { HTMLAttributes, ReactNode } from "react";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: "default" | "muted" | "outline";
  size?: "xs" | "sm";
  className?: string;
}

/**
 * Chip pequeno e discreto para especificações do veículo nos cards e listas.
 * Segue o design system com tokens: cores ink/muted, tipografia font-body xs.
 */
export function Chip({
  children,
  variant = "default",
  size = "xs",
  className = "",
  ...props
}: ChipProps) {
  const sizeClasses =
    size === "xs"
      ? "text-xs px-2 py-0.5 leading-normal"
      : "text-sm px-2.5 py-1 leading-normal";

  const variantClasses =
    variant === "muted"
      ? "bg-ink/80 text-muted border border-white/10"
      : variant === "outline"
        ? "bg-transparent text-muted border border-white/15"
        : "bg-ink text-cream/90 border border-white/10";

  return (
    <span
      className={`inline-flex items-center justify-center font-body font-medium rounded ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
