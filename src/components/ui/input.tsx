"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string;
  hint?: string;
  suffix?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
  lg: "px-4 py-2.5 text-base",
} as const;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, suffix, size = "md", className, id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-navy mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full rounded-lg border bg-white text-navy transition-colors",
            "placeholder:text-warm-gray-400",
            "focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none",
            sizeStyles[size],
            suffix && "pr-14",
            error
              ? "border-terracotta focus:border-terracotta focus:ring-terracotta"
              : "border-warm-gray-200"
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-warm-gray-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-sm text-terracotta mt-1" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-sm text-warm-gray-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
});

export { Input };
export type { InputProps };
