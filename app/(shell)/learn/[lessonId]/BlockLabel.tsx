import { BookOpen, FlaskConical, Lightbulb, SquareCode, type LucideIcon } from "lucide-react";
import type { LessonBlockDTO } from "@/lib/data/types";

const KIND_LABELS: Partial<Record<LessonBlockDTO["kind"], { label: string; Icon: LucideIcon }>> = {
  text: { label: "Concept", Icon: BookOpen },
  analogy: { label: "Analogy", Icon: Lightbulb },
  example: { label: "Example", Icon: FlaskConical },
  code: { label: "Code", Icon: SquareCode },
};

/** Small uppercase kind label with an icon, shared by every lesson block. */
export function BlockLabel({
  kind,
  label,
  Icon,
}: {
  kind?: LessonBlockDTO["kind"];
  label?: string;
  Icon?: LucideIcon;
}) {
  const known = kind ? KIND_LABELS[kind] : undefined;
  const text = label ?? known?.label;
  const Glyph = Icon ?? known?.Icon;
  if (!text) return null;
  return (
    <p className="text-muted-foreground flex items-center gap-1.5 text-[10.5px] font-medium tracking-[0.14em] uppercase">
      {Glyph && <Glyph aria-hidden className="size-3" />}
      {text}
    </p>
  );
}
