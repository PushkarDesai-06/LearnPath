"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  THEME_LABEL,
  THEME_ORDER,
  useThemeCycle,
  type ThemeChoice,
} from "@/components/useThemeCycle";
import { cn } from "@/lib/utils";

const SWATCH: Record<ThemeChoice, { surface: string; line: string; ink: string }> =
  {
    light: { surface: "#fcfcfd", line: "#e4e4e7", ink: "#111113" },
    dark: { surface: "#08090a", line: "#26272b", ink: "#f4f5f6" },
    system: { surface: "", line: "", ink: "" },
  };

function Preview({ choice }: { choice: ThemeChoice }) {
  if (choice === "system") {
    return (
      <div className="relative flex h-14 overflow-hidden rounded-md border border-border-strong">
        <Half theme="light" />
        <Half theme="dark" />
      </div>
    );
  }
  return (
    <div className="flex h-14 overflow-hidden rounded-md border border-border-strong">
      <Half theme={choice} full />
    </div>
  );
}

function Half({ theme, full }: { theme: "light" | "dark"; full?: boolean }) {
  const { surface, line, ink } = SWATCH[theme];
  return (
    <div
      aria-hidden
      className={cn("flex flex-1 flex-col gap-1.5 p-2", !full && "overflow-hidden")}
      style={{ background: surface }}
    >
      <span className="h-1.5 w-8 rounded-full" style={{ background: ink }} />
      <span className="h-1.5 w-full rounded-full" style={{ background: line }} />
      <span className="h-1.5 w-2/3 rounded-full" style={{ background: line }} />
    </div>
  );
}

export function AppearanceSection() {
  const { theme, setTheme, mounted } = useThemeCycle();

  return (
    <RadioGroup
      aria-label="Theme"
      value={mounted ? theme : ""}
      onValueChange={(value) => setTheme(value as ThemeChoice)}
      className="grid-cols-3 gap-3"
    >
      {THEME_ORDER.map((choice) => (
        <label
          key={choice}
          htmlFor={`theme-${choice}`}
          className={cn(
            "flex cursor-pointer flex-col gap-2 rounded-lg border border-border p-2 transition-colors duration-(--dur-fast) hover:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-foreground",
            mounted && theme === choice && "border-foreground bg-surface-1",
          )}
        >
          <Preview choice={choice} />
          <span className="flex items-center justify-between gap-2 px-0.5 text-[13px]">
            {THEME_LABEL[choice]}
            <RadioGroupItem value={choice} id={`theme-${choice}`} />
          </span>
        </label>
      ))}
    </RadioGroup>
  );
}
