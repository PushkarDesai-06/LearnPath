"use client";

import { useActionState, useState } from "react";
import { updateDisplayNameAction, type ProfileFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingRing } from "@/components/ui/loading-ring";

type State = ProfileFormState & { savedValue: string | null };

/** Inline editor for the display name; blank clears it back to the email. */
export function DisplayNameForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, save, saving] = useActionState(
    async (prev: State, form: FormData): Promise<State> => {
      const res = await updateDisplayNameAction(prev, form);
      return { ...res, savedValue: res.saved ? String(form.get("displayName") ?? "").trim() : prev.savedValue };
    },
    { error: null, saved: false, savedValue: null },
  );
  const dirty = value.trim() !== (state.savedValue ?? initial).trim();

  return (
    <form
      action={save}
      className="flex flex-col gap-1.5"
    >
      <label
        htmlFor="displayName"
        className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]"
      >
        Display name
      </label>
      <div className="flex items-center gap-2">
        <Input
          id="displayName"
          name="displayName"
          value={value}
          maxLength={60}
          placeholder="How LearnPath greets you"
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="displayName-status"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" disabled={saving || !dirty}>
          {saving && <LoadingRing data-icon="inline-start" />}
          Save
        </Button>
      </div>
      <p id="displayName-status" role="status" className="min-h-4 text-xs">
        {state.error ? (
          <span className="text-destructive">{state.error}</span>
        ) : state.saved && !dirty ? (
          <span className="text-muted-foreground">Saved.</span>
        ) : null}
      </p>
    </form>
  );
}
