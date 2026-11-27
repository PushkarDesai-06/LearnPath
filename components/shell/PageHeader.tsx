import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { MobileSidebarTrigger } from "@/components/shell/MobileSidebarTrigger";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * The 44px sticky bar on every shell page: mobile sidebar trigger, breadcrumbs
 * (the last segment is the page and truncates), then `actions` for the page's
 * primary buttons and `menu` for its page level 3 dot menu.
 */
export function PageHeader({
  breadcrumbs,
  actions,
  menu,
  className,
}: {
  breadcrumbs: Crumb[];
  actions?: ReactNode;
  menu?: ReactNode;
  className?: string;
}) {
  const lastIndex = breadcrumbs.length - 1;

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-11 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-4",
        className,
      )}
    >
      <MobileSidebarTrigger />
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-[13px]">
          {breadcrumbs.map((crumb, index) => {
            const last = index === lastIndex;
            return (
              <li
                key={`${index}-${crumb.label}`}
                className={cn(
                  "flex items-center gap-1",
                  last ? "min-w-0" : "shrink-0 max-sm:hidden",
                )}
              >
                {index > 0 && (
                  <ChevronRight
                    aria-hidden
                    className="size-3 shrink-0 text-faint"
                  />
                )}
                {crumb.href && !last ? (
                  <Link
                    href={crumb.href}
                    className="max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-muted-foreground outline-none transition-colors duration-(--dur-fast) hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn(
                      "truncate px-1.5 py-0.5",
                      last
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {crumb.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      {(actions || menu) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          {menu}
        </div>
      )}
    </header>
  );
}
