"use client";

/**
 * The message box shared by the tutor and the onboarding chat: Enter sends,
 * Shift+Enter breaks a line, and the whole box carries the focus ring (the
 * textarea inside is borderless, so its own ring would sit inside the frame).
 */
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingRing } from "@/components/ui/loading-ring";
import { cn } from "@/lib/utils";

export function ChatComposer({
  id,
  label,
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  busy,
  disabled,
  autoFocus,
  className,
}: {
  id: string;
  /** Visually hidden, but names the textbox for assistive tech. */
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  busy: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className={cn(
        "bg-surface-1 border-border flex flex-col gap-1 rounded-xl border p-3 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.5)] transition-[border-color,box-shadow]",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        id={id}
        autoFocus={autoFocus}
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Ignore Enter while an IME is composing a character.
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-describedby={`${id}-hint`}
        className="min-h-[60px] resize-none border-0 bg-transparent px-2.5 py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span
          id={`${id}-hint`}
          className="text-muted-foreground/70 font-mono text-[10px] uppercase tracking-[0.12em]"
        >
          ↵ to send · ⇧↵ for newline
        </span>
        <Button type="submit" size="sm" disabled={busy || disabled || !value.trim()}>
          {busy ? <LoadingRing data-icon="inline-start" /> : <Send data-icon="inline-start" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
