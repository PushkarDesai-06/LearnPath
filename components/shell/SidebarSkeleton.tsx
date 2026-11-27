import { LogoTile } from "@/components/brand/Logo";
import { Skeleton } from "@/components/ui/skeleton";

function RowSkeleton({ width }: { width: string }) {
  return (
    <div className="flex h-7 items-center gap-2 pl-[10px]">
      <Skeleton className="size-4 shrink-0 rounded-md" />
      <Skeleton className="h-3" style={{ width }} />
    </div>
  );
}

/** Stand in while the shell data streams, same geometry as the real sidebar. */
export function SidebarSkeleton() {
  return (
    <div aria-hidden className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 p-2 pb-1">
        <div className="flex h-8 flex-1 items-center gap-2 pl-2">
          <LogoTile />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="px-2 pt-1 pb-2">
        <Skeleton className="h-7 w-full rounded-md" />
      </div>
      <div className="flex flex-col gap-px px-2">
        {["56%", "40%", "34%", "52%"].map((w, i) => (
          <RowSkeleton key={i} width={w} />
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-px px-2">
        <Skeleton className="mb-1 ml-[10px] h-2.5 w-12" />
        {["70%", "62%", "48%"].map((w, i) => (
          <RowSkeleton key={i} width={w} />
        ))}
      </div>
      <div className="flex-1" />
      <div className="h-[45px] border-t border-sidebar-border" />
    </div>
  );
}
