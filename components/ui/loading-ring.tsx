import { cn } from "@/lib/utils"

// Themed circular loading ring — a faint full-circle track with a rotating
// primary-colored arc. Defaults to size-4 so it drops straight into buttons
// where <Spinner /> was used; override via className (e.g. PageLoader uses size-7).
function LoadingRing({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      role="status"
      aria-label="Loading"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("text-primary size-4 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        strokeWidth="2.5"
        className="stroke-current opacity-20"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-current"
      />
    </svg>
  )
}

// Centered full-panel loader for route/page-level waits.
function PageLoader({
  label,
  sublabel,
  className,
}: {
  label?: string
  sublabel?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 py-24", className)}>
      <LoadingRing className="size-7" />
      {label && <p className="text-foreground text-sm">{label}</p>}
      {sublabel && <p className="text-muted-foreground text-xs">{sublabel}</p>}
    </div>
  )
}

export { LoadingRing, PageLoader }
