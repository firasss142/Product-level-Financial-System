import { cn } from "@/lib/utils";

const variantStyles = {
  delivered: "bg-emerald/10 text-emerald-dark",
  returned: "bg-terracotta/10 text-terracotta-dark",
  pending: "bg-amber/10 text-amber-dark",
  rejected: "bg-warm-gray-200 text-warm-gray-600",
  default: "bg-warm-gray-100 text-warm-gray-600",
} as const;

type BadgeVariant = keyof typeof variantStyles;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeVariant };
