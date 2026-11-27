"use client";

import { Fragment, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import {
  displayKey,
  filterShortcuts,
  isKeyConnector,
  SHORTCUTS,
} from "@/components/shell/shortcuts";
import { useIsMac } from "@/lib/client/platform";

export function KeyChips({ keys, isMac }: { keys: string[]; isMac: boolean }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((token, index) =>
        isKeyConnector(token) ? (
          <span key={index} className="text-[11px] text-faint">
            {token}
          </span>
        ) : (
          <Kbd key={index}>{displayKey(token, isMac)}</Kbd>
        ),
      )}
    </span>
  );
}

function SheetBody() {
  const isMac = useIsMac();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => filterShortcuts(SHORTCUTS, query), [query]);

  return (
    <>
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter shortcuts"
          aria-label="Filter shortcuts"
          autoComplete="off"
          className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
        />
      </div>
      <div className="max-h-[min(60vh,480px)] overflow-y-auto px-4 py-3 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin]">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No shortcuts match.
          </p>
        ) : (
          groups.map((group) => (
            <Fragment key={group.group}>
              <h3 className="px-1 pt-2 pb-1 text-[11.5px] font-medium text-faint">
                {group.group}
              </h3>
              <ul className="mb-2">
                {group.items.map((item) => (
                  <li
                    key={`${group.group}:${item.label}`}
                    className="flex min-h-8 items-center justify-between gap-4 rounded-md px-1 py-1 text-[13px] text-fg-2"
                  >
                    <span>{item.label}</span>
                    <KeyChips keys={item.keys} isMac={isMac} />
                  </li>
                ))}
              </ul>
            </Fragment>
          ))
        )}
      </div>
    </>
  );
}

/** Every shortcut by group, centered dialog on every screen size. Focus is trapped by the dialog. */
export function ShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] gap-0 overflow-hidden p-0 sm:max-w-lg translate-y-0 motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
      >
        <DialogTitle className="sr-only">Keyboard shortcuts</DialogTitle>
        <DialogDescription className="sr-only">
          Every keyboard shortcut in LearnPath, grouped by area.
        </DialogDescription>
        <SheetBody />
      </DialogContent>
    </Dialog>
  );
}
