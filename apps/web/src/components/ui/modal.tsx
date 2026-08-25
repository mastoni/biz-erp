import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
}: ModalProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-pine-deep/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-xl transition-all animate-in fade-in zoom-in-95 duration-150",
          maxWidthClass
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 border-b border-line/80 pb-3 mb-4">
            <div>
              {title && (
                <h2 className="font-heading text-lg font-bold text-ink">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-fog">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-fog hover:bg-surface-soft hover:text-ink transition"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
