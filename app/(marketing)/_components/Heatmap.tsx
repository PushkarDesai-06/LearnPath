import { ScrollReveal } from "./ScrollReveal";

const WEEKS = 12;
const DAYS = 7;
const OPACITY = [0.07, 0.25, 0.45, 0.7, 1] as const;

function levelAt(week: number, day: number) {
  const raw = (week * 5 + day * 11 + ((week * day) % 7)) % 5;
  return week < 3 ? Math.min(raw, 1) : raw;
}

/** Decorative, deterministic activity grid that fills in column by column. */
export function Heatmap() {
  return (
    <ScrollReveal reveal={false} threshold={0.5}>
      <div
        aria-hidden
        className="grid grid-flow-col grid-rows-7 gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: WEEKS * DAYS }, (_, index) => {
          const week = Math.floor(index / DAYS);
          const day = index % DAYS;
          return (
            <span
              key={index}
              className="lp-cell bg-foreground aspect-square rounded-[3px]"
              style={
                {
                  "--c": week,
                  "--o": OPACITY[levelAt(week, day)],
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>
      <p className="text-muted-foreground mt-2 text-xs">
        Illustration of twelve weeks of review activity.
      </p>
    </ScrollReveal>
  );
}
