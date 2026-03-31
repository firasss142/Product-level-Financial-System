import { cn } from "@/lib/utils";

const variantStyles = {
  primary:
    "bg-navy text-white hover:bg-navy-light focus-visible:outline-navy",
  secondary:
    "bg-transparent border border-navy text-navy hover:bg-warm-gray-100 focus-visible:outline-navy",
  danger:
    "bg-terracotta text-white hover:bg-terracotta-light focus-visible:outline-terracotta",
  ghost:
    "bg-transparent text-navy hover:bg-warm-gray-100 focus-visible:outline-navy",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
} as const;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "min-h-[44px] md:min-h-0",
        "cursor-pointer",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}

export { Button };
export type { ButtonProps };
