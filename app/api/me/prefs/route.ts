/** Partial update of the synced view options, group collapse and focus preference. */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { handler, json, readJson } from "@/lib/http";
import { mutatePrefs, prefsDTO } from "@/lib/server/prefs";

const Body = z
  .object({
    dashboard: z
      .object({
        groupBy: z.enum(["module", "status"]),
        hideMastered: z.boolean(),
        hideLocked: z.boolean(),
        showSummaries: z.boolean(),
      })
      .partial()
      .strict(),
    collapsedGroups: z.array(z.string().min(1).max(120)).max(200),
    focusLessons: z.boolean(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");

export const PATCH = handler(async (request) => {
  const user = await requireUser();
  const body = await readJson(request, Body);
  const prefs = await mutatePrefs(user._id, (current) => {
    const next = {
      dashboard: { ...current.dashboard, ...body.dashboard },
      collapsedGroups: body.collapsedGroups ?? current.collapsedGroups,
      focusLessons: body.focusLessons ?? current.focusLessons,
    };
    return { value: { ...current, ...next }, changes: next };
  });
  return json({ prefs: prefsDTO(prefs) });
});
