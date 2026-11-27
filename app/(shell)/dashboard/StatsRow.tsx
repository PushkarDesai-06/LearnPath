import type { ReactNode } from "react";
import { BookCheck, Clock, Layers } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MasteryRing } from "@/components/MasteryRing";
import { formatDuration } from "@/lib/client/dates";
import type { DashboardData } from "@/lib/data/types";

type Summary = Extract<DashboardData, { hasCurriculum: true }>["summary"];

function Stat({
  icon,
  value,
  label,
  hint,
}: {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className="flex items-center gap-2.5 rounded-[10px] bg-surface-1 px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--border)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          <span className="flex size-7 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-5">
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-[17px] leading-tight font-semibold tracking-tight tabular-nums">
              {value}
            </p>
            <p className="truncate text-[11.5px] text-muted-foreground">{label}</p>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function StatsRow({ summary }: { summary: Summary }) {
  const percent = Math.round(summary.overallMastery * 100);

  return (
    <section
      aria-label="Progress"
      className="grid grid-cols-2 gap-2.5 lg:grid-cols-4"
    >
      <Stat
        icon={<MasteryRing value={summary.overallMastery} size={28} />}
        value={
          <>
            <span className="lp-count" style={{ "--lp-n": percent } as React.CSSProperties} />%
          </>
        }
        label="Mastery"
        hint="The average mastery score across every lesson in this topic, including lessons you have not started."
      />
      <Stat
        icon={<BookCheck />}
        value={`${summary.lessonsMastered}/${summary.lessonsTotal}`}
        label="Lessons mastered"
        hint="Lessons whose mastery reached 80% or more, out of all lessons in the path."
      />
      <Stat
        icon={<Layers />}
        value={`${summary.modulesCompleted}/${summary.modulesTotal}`}
        label="Modules done"
        hint="Modules where every lesson is mastered."
      />
      <Stat
        icon={<Clock />}
        value={formatDuration(summary.totalTimeMs)}
        label="Time spent"
        hint="Time recorded while you worked through lessons and practice in this topic."
      />
    </section>
  );
}
