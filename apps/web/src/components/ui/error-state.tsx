import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, RotateCcw } from "lucide-react"
import { Button } from "./button"

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Terjadi Kesalahan",
  message,
  onRetry,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center rounded-xl border border-clay/20 bg-clay-soft/40 text-ink",
        className
      )}
      {...props}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-clay-soft text-clay mb-2.5">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="font-heading text-sm font-semibold text-clay">{title}</h3>
      <p className="mt-1 text-xs text-fog max-w-sm">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-3.5 text-xs h-7 border-clay/30 hover:bg-clay-soft"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Coba Lagi
        </Button>
      )}
    </div>
  );
}
