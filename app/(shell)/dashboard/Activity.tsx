import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FlameIcon } from "@/components/icons/animated";
import { getActivity } from "@/lib/data/activity";
import { readTimeZone } from "@/lib/server/timezone";
import { formatCalendarDay, weekdayOf } from "@/lib/client/dates";
import type { ActivityData } from "@/lib/data/types";

const LEVELS = [
  "bg-foreground/[0.08]",
  "bg-foreground/25",
  "bg-foreground/45",
  "bg-foreground/70",
  "bg-foreground",
] as const;

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function levelOf(total: number, max: number) {
  if (total === 0 || max === 0) return 0;
  return Math.max(1, Math.ceil((total / max) * 4));
}

function cellLabel(day: ActivityData["days"][number]) {
  const date = formatCalendarDay(day.date);
  if (day.total === 0) return `${date} · No activity`;
  return `${date} · ${plural(day.lessons, "lesson")}, ${plural(day.answers, "answer")}`;
}

function Streak({
  value,
  label,
  active = false,
}: {
  value: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="flex items-center gap-1.5 text-xl font-semibold tracking-tight tabular-nums">
        {label === "Current streak" && (
          <FlameIcon active={active} className="size-4" />
        )}
        {plural(value, "day")}
      </p>
      <p className="text-[11.5px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function ActivitySkeleton() {
  return (
    <section
      aria-hidden
      className="flex items-center gap-[18px] rounded-[10px] bg-surface-1 px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <Skeleton className="h-[85px] w-[170px] max-w-full flex-1 sm:flex-none sm:w-[190px]" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-20" />
      </div>
    </section>
  );
}

/** Streams in behind its own Suspense so the heavier events read never holds the page. */
export async function Activity({
  userId,
  curriculumId,
}: {
  userId: string;
  curriculumId: string;
}) {
  const timeZone = await readTimeZone();
  const { days, currentStreak, bestStreak } = await getActivity(
    userId,
    curriculumId,
    timeZone,
  );
  const max = Math.max(0, ...days.map((day) => day.total));
  const leading = days.length > 0 ? weekdayOf(days[0].date) : 0;
  const activeDays = days.filter((day) => day.total > 0).length;

  return (
    <section
      aria-label="Activity"
      className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[10px] bg-surface-1 px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      <div className="min-w-0 max-w-full overflow-x-auto">
        <div
          role="img"
          aria-label={`Activity over the last 12 weeks: ${plural(activeDays, "active day")}`}
          className="grid w-max auto-cols-[10px] grid-flow-col grid-rows-[repeat(7,10px)] gap-[3px]"
        >
          {Array.from({ length: leading }, (_, index) => (
            <i key={`pad-${index}`} aria-hidden />
          ))}
          {days.map((day) => (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <i
                  className={`rounded-[2.5px] transition-transform duration-(--dur-fast) hover:scale-[1.35] ${LEVELS[levelOf(day.total, max)]}`}
                />
              </TooltipTrigger>
              <TooltipContent>{cellLabel(day)}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
      <div className="flex gap-6">
        <Streak value={currentStreak} label="Current streak" active={currentStreak > 0} />
        <Streak value={bestStreak} label="Best streak" />
      </div>
    </section>
  );
}
