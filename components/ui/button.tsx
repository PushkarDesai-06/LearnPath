import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-lg border-0 text-[13px] font-medium whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-(--dur-fast) ease-(--ease-out) outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default:
          "btn-sheen overflow-hidden bg-(image:--primary-gradient) text-primary-foreground shadow-(--primary-highlight) hover:brightness-[1.03] aria-expanded:brightness-95",
        outline:
          "bg-transparent text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-hover aria-expanded:bg-active",
        secondary:
          "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--border-strong)] hover:bg-surface-3 aria-expanded:bg-surface-3",
        ghost:
          "text-fg-2 hover:bg-hover hover:text-foreground aria-expanded:bg-active aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--destructive),transparent_75%)] hover:bg-destructive/18 aria-expanded:bg-destructive/20",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-[30px] gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[26px] gap-1.5 rounded-[7px] px-2.5 text-[12.5px] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-9 gap-2 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        icon: "size-7 p-0",
        "icon-xs": "size-5 rounded-md p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-6 rounded-md p-0",
        "icon-lg": "size-8 p-0",
      },
    },
    compoundVariants: [
      {
        variant: ["ghost", "outline", "secondary"],
        size: ["icon", "icon-xs", "icon-sm", "icon-lg"],
        className: "text-muted-foreground hover:text-foreground",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        buttonVariants({ variant, size, className }),
        loading && "disabled:opacity-100"
      )}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center justify-center gap-[inherit] opacity-25">
            {children}
          </span>
          <Loader2Icon
            aria-hidden
            className="absolute size-3.5 animate-spin"
          />
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
