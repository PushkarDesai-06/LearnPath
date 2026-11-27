"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ComponentProps,
} from "react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

interface SidebarUiValue {
  /** Icon rail: collapsed and not peeking. Labels fade, trailing controls hide. */
  rail: boolean;
  /** Menus inside the sidebar open to the right in the rail, otherwise where the caller asks. */
  menuSide: (preferred: "bottom" | "top") => "bottom" | "top" | "right";
  /** Menus hold the peek layer open while they are showing. */
  holdPeek: (held: boolean) => void;
}

export const SidebarUiContext = createContext<SidebarUiValue>({
  rail: false,
  menuSide: (preferred) => preferred,
  holdPeek: () => {},
});

export function useSidebarUi() {
  return useContext(SidebarUiContext);
}

/** A Radix dropdown that keeps the hover peek open for as long as it is showing. */
export function SidebarDropdownMenu({
  onOpenChange,
  ...props
}: ComponentProps<typeof DropdownMenu>) {
  const { holdPeek } = useSidebarUi();
  const held = useRef(false);

  const hold = (next: boolean) => {
    if (held.current === next) return;
    held.current = next;
    holdPeek(next);
  };

  useEffect(
    () => () => {
      if (held.current) holdPeek(false);
    },
    [holdPeek],
  );

  return (
    <DropdownMenu
      {...props}
      onOpenChange={(open) => {
        hold(open);
        onOpenChange?.(open);
      }}
    />
  );
}
