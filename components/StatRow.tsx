/**
 * The instrument-panel strip of numbers used by the path, flashcards and
 * account pages: mono figures over mono caps labels, between two hairlines.
 */
import { cn } from "@/lib/utils";

export interface Stat {
  label: string;
  value: string;
}

export function StatRow({ stats, className }: { stats: Stat[]; className?: string }) {
  return (
    <dl
      className={cn(
        "border-border grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5",
        stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4",
        className,
      )}
    >
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col-reverse gap-1">
          <dt className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
            {s.label}
          </dt>
          <dd className="font-mono text-2xl font-normal tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
