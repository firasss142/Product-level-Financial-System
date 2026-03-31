"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
} from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";
import { CloseIcon } from "./icons";

type ToastVariant = "success" | "error" | "info";

interface ToastData {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toast: (data: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
}

type Action =
  | { type: "ADD"; toast: ToastData }
  | { type: "REMOVE"; id: string };

function reducer(state: ToastData[], action: Action): ToastData[] {
  switch (action.type) {
    case "ADD":
      return [...state, action.toast];
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
  }
}

const ToastContext = createContext<ToastContextValue | null>(null);

function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast doit \u00eatre utilis\u00e9 dans un ToastProvider");
  }
  return ctx;
}

const variantStyles = {
  success: "border-l-4 border-l-emerald",
  error: "border-l-4 border-l-terracotta",
  info: "border-l-4 border-l-navy",
} as const;

const variantIcons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="text-emerald shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 10l3 3 5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  error: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="text-terracotta shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v5M10 13.5v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  info: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      className="text-navy shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 9v5M10 6.5v.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
};

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);

  const toast = useCallback(
    (data: Omit<ToastData, "id">) => {
      const id = crypto.randomUUID();
      dispatch({ type: "ADD", toast: { ...data, id } });
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration ?? 5000}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            className={cn(
              "bg-white shadow-lg rounded-lg p-4 flex items-start gap-3",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out",
              "transition-all duration-200",
              variantStyles[t.variant]
            )}
          >
            {variantIcons[t.variant]}
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium text-navy">
                {t.title}
              </ToastPrimitive.Title>
              {t.description && (
                <ToastPrimitive.Description className="text-sm text-warm-gray-500 mt-0.5">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              className="text-warm-gray-400 hover:text-warm-gray-600 transition-colors shrink-0 cursor-pointer"
              aria-label="Fermer"
            >
              <CloseIcon />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export { ToastProvider, useToast };
export type { ToastData, ToastVariant };
