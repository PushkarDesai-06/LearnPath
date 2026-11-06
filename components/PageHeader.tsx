/**
 * The page hero every app page uses: a mono eyebrow naming the page, the H1
 * (the topic on topic-scoped pages), an optional line of description, and an
 * optional row of actions. On phones the actions drop under the title instead
 * of squeezing it into a narrow column.
 */
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <h1 className="h-display min-w-0 text-3xl [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </header>
  );
}
