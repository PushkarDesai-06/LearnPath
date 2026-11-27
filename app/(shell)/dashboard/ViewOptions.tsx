"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboard } from "./DashboardProvider";

const keepOpen = (event: Event) => event.preventDefault();

export function ViewOptions() {
  const { prefs, setPrefs } = useDashboard();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" aria-label="View options">
          <SlidersHorizontal data-icon="inline-start" />
          <span className="max-sm:sr-only">View</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Group by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.groupBy}
          onValueChange={(value) =>
            setPrefs({ groupBy: value === "status" ? "status" : "module" })
          }
        >
          <DropdownMenuRadioItem value="module" onSelect={keepOpen}>
            Module
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="status" onSelect={keepOpen}>
            Status
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={prefs.hideMastered}
          onSelect={keepOpen}
          onCheckedChange={(checked) => setPrefs({ hideMastered: checked })}
        >
          Hide mastered
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={prefs.hideLocked}
          onSelect={keepOpen}
          onCheckedChange={(checked) => setPrefs({ hideLocked: checked })}
        >
          Hide locked
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={prefs.showSummaries}
          onSelect={keepOpen}
          onCheckedChange={(checked) => setPrefs({ showSummaries: checked })}
        >
          Show module summaries
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
