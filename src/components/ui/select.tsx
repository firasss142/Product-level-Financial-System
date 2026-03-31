"use client";

import { useId } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  label: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

function Select({
  label,
  options,
  value,
  onValueChange,
  placeholder = "S\u00e9lectionner\u2026",
  error,
  disabled,
  className,
}: SelectProps) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-navy mb-1.5"
      >
        {label}
      </label>
      <SelectPrimitive.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectPrimitive.Trigger
          id={id}
          className={cn(
            "flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-navy transition-colors",
            "focus:border-navy focus:ring-1 focus:ring-navy focus:outline-none",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "cursor-pointer",
            error
              ? "border-terracotta focus:border-terracotta focus:ring-terracotta"
              : "border-warm-gray-200"
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-warm-gray-400"
              aria-hidden="true"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-50 bg-white rounded-lg shadow-md border border-warm-gray-200 py-1 overflow-hidden"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="max-h-60">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm text-navy cursor-pointer outline-none",
                    "data-[highlighted]:bg-warm-gray-50",
                    "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed"
                  )}
                >
                  <SelectPrimitive.ItemText>
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="ml-auto">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 7l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>

      {error && (
        <p id={errorId} className="text-sm text-terracotta mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { Select };
export type { SelectProps, SelectOption };
