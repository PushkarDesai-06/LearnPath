import { Layers, LayoutDashboard, MessagesSquare } from "lucide-react";
import { LogoTile } from "@/components/brand/Logo";
import { FlameIcon } from "@/components/icons/animated";
import { MasteryRing } from "@/components/MasteryRing";
import { StatusIcon, type StatusIconStatus } from "@/components/StatusIcon";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Review", icon: Layers, active: false },
  { label: "Tutor", icon: MessagesSquare, active: false },
] as const;

const TOPICS = [
  { name: "Python for data", mastery: 0.64, open: true },
  { name: "Spanish basics", mastery: 0.32, open: false },
  { name: "Music theory", mastery: 0.12, open: false },
] as const;

const LESSONS: readonly {
  title: string;
  status: StatusIconStatus;
  mastery?: number;
}[] = [
  { title: "Series and DataFrames", status: "mastered" },
  { title: "Filtering rows", status: "mastered" },
  { title: "Group and aggregate", status: "in_progress", mastery: 0.6 },
  { title: "Handling missing values", status: "needs_review" },
  { title: "Merging tables", status: "locked" },
];

const STATS = [
  { label: "Mastery", value: "64%" },
  { label: "Streak", value: "6 days", flame: true },
  { label: "Cards due", value: "12" },
] as const;

/** A static miniature of the dashboard. Purely illustrative, so hidden from assistive tech. */
export function ProductFrame() {
  return (
    <div
      aria-hidden
      className="lp-frame border-border-strong from-surface-1 to-background pointer-events-none relative mx-auto h-[340px] w-full max-w-5xl overflow-hidden rounded-t-2xl border border-b-0 bg-linear-to-b text-left select-none sm:h-[430px] [mask-image:linear-gradient(to_bottom,#000_72%,transparent)]"
    >
      <div className="grid h-full grid-cols-1 sm:grid-cols-[200px_1fr]">
        <aside className="bg-sidebar border-border hidden flex-col gap-4 border-r p-3 sm:flex">
          <div className="flex items-center gap-2 px-1">
            <LogoTile />
            <span className="text-[13px] font-semibold tracking-tight">
              LearnPath
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {NAV.map(({ label, icon: Icon, active }) => (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium",
                  active ? "bg-active text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <span className="text-faint px-2 text-[10px] font-medium tracking-wide uppercase">
              Topics
            </span>
            <ul className="flex flex-col gap-0.5">
              {TOPICS.map((topic) => (
                <li key={topic.name} className="flex flex-col">
                  <div className="text-fg-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
                    <MasteryRing value={topic.mastery} size={14} />
                    <span className="truncate">{topic.name}</span>
                  </div>
                  {topic.open && (
                    <ul className="border-border ml-[15px] flex flex-col border-l pl-2">
                      {["Basics", "Aggregation"].map((module) => (
                        <li
                          key={module}
                          className="text-muted-foreground px-2 py-1 text-[11px]"
                        >
                          {module}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-3 p-4 sm:p-5">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
            <span>Python for data</span>
            <span className="text-faint">/</span>
            <span className="text-foreground font-medium">Dashboard</span>
          </div>

          <div className="bg-surface-1 border-border flex items-center gap-3 rounded-xl border p-3 sm:p-4">
            <MasteryRing value={0.6} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-faint text-[10px] font-medium tracking-wide uppercase">
                Continue
              </p>
              <p className="truncate text-[13px] font-semibold">
                Group and aggregate
              </p>
              <p className="text-muted-foreground truncate text-[11px]">
                Module 2 of 4
              </p>
            </div>
            <span className="text-primary-foreground rounded-lg bg-(image:--primary-gradient) px-3 py-1.5 text-xs font-medium shadow-(--primary-highlight)">
              Resume
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="bg-surface-1 border-border rounded-lg border p-2.5"
              >
                <p className="text-muted-foreground flex items-center gap-1 text-[10px]">
                  {stat.label}
                  {"flame" in stat && <FlameIcon className="size-3" />}
                </p>
                <p className="text-sm font-semibold tabular-nums">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <ul className="bg-surface-1 border-border divide-border flex flex-col divide-y rounded-xl border">
            {LESSONS.map((lesson) => (
              <li
                key={lesson.title}
                className="flex items-center gap-2.5 px-3 py-2 text-xs"
              >
                <StatusIcon
                  status={lesson.status}
                  mastery={lesson.mastery}
                  animate={false}
                />
                <span
                  className={cn(
                    "truncate",
                    lesson.status === "locked" && "text-muted-foreground",
                  )}
                >
                  {lesson.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
