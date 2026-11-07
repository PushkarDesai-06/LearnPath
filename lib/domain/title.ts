/**
 * Curriculum titles name the topic, nothing more. The model tends to wrap the
 * subject in boilerplate ("Personalized SQL Learning Path for Beginner"), and
 * the title is the H1 of three pages and the topic switcher's label. This trims
 * that wrapping; a title that would trim to nothing is kept as written.
 */
const LEVEL = "(?:novice|beginner|intermediate|advanced|expert)s?";

const RULES: RegExp[] = [
  /^\s*(?:your\s+)?(?:personali[sz]ed\s+)?learning\s+path\s*[:\-–—]\s*/i,
  new RegExp(`\\s+for\\s+(?:an?\\s+)?${LEVEL}(?:\\s+learners?)?\\s*$`, "i"),
  /\s+learning\s+path\s*$/i,
  /\s+(?:learning\s+path|curriculum)(?=\s*[:\-–—])/i,
];

/** Remove explicit learning-path wrappers while preserving ambiguous topic words. */
export function tidyCurriculumTitle(title: string): string {
  let out = title.trim();
  if (/\s+learning\s+path(?:\s+for\s+(?:an?\s+)?(?:novice|beginner|intermediate|advanced|expert)s?(?:\s+learners?)?)?\s*$/i.test(out)) {
    out = out.replace(/^personali[sz]ed\s+/i, "");
  }
  for (let pass = 0; pass < 2; pass++) {
    for (const rule of RULES) out = out.replace(rule, "").trim();
  }
  out = out.replace(/\s*[:\-–—]\s*$/, "").replace(/\s{2,}/g, " ").trim();
  return out || title.trim();
}
