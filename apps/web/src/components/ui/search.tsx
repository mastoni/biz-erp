import * as React from "react"
import { Search as SearchIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const Search = React.forwardRef<HTMLInputElement, SearchProps>(
  ({ className, value, onChange, onClear, placeholder = "Cari...", ...props }, ref) => {
    return (
      <div className="relative w-full">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fog pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border border-line bg-white/90 pl-9 pr-8 py-2 text-sm text-ink placeholder:text-fog/60 outline-none focus:border-pine focus:ring-2 focus:ring-pine/15 transition",
            className
          )}
          {...props}
        />
        {Boolean(value) && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fog hover:text-ink transition p-0.5 rounded-sm"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);

Search.displayName = "Search";
