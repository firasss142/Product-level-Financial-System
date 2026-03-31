"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { CloseIcon } from "./icons";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  confirmVariant?: "primary" | "danger";
  loading?: boolean;
  className?: string;
}

function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  confirmVariant = "primary",
  loading = false,
  className,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-40 bg-navy/40 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out",
            "transition-all duration-200"
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4",
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95",
            "transition-all duration-200",
            "focus:outline-none",
            className
          )}
        >
          <Dialog.Title className="text-lg font-semibold text-navy">
            {title}
          </Dialog.Title>

          {description && (
            <Dialog.Description className="text-sm text-warm-gray-500 mt-1">
              {description}
            </Dialog.Description>
          )}

          <div className="mt-4">{children}</div>

          {footer !== undefined ? (
            footer
          ) : onConfirm ? (
            <div className="mt-6 flex items-center justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </Dialog.Close>
              <Button
                variant={confirmVariant}
                onClick={() => void Promise.resolve(onConfirm?.())}
                loading={loading}
              >
                {confirmLabel}
              </Button>
            </div>
          ) : (
            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <Button variant="secondary">{cancelLabel}</Button>
              </Dialog.Close>
            </div>
          )}

          <Dialog.Close
            className="absolute top-4 right-4 text-warm-gray-400 hover:text-warm-gray-600 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <CloseIcon />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { Modal };
export type { ModalProps };
