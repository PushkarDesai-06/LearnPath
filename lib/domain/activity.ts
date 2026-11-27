/**
 * Activity heatmap and streaks. Pure: events in, calendar-day buckets out.
 * Days are calendar days in the learner's IANA time zone, so a late night
 * session lands on the day the learner lived it, not the UTC day.
 */
export const ACTIVITY_DAYS = 84;

export type ActivityKind = "lesson" | "answer";

export interface ActivityEvent {
  at: Date;
  kind: ActivityKind;
}

export interface ActivityDay {
  /** YYYY-MM-DD in the learner's time zone. */
  date: string;
  lessons: number;
  answers: number;
  total: number;
}

export interface Activity {
  days: ActivityDay[];
  currentStreak: number;
  bestStreak: number;
}

const ZONE_NAME = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/;

export function isValidTimeZone(value: string): boolean {
  if (!ZONE_NAME.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day an instant falls on in a time zone, as YYYY-MM-DD. */
export function dayKey(at: Date, timeZone: string): string {
  const parts = formatterFor(timeZone).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

const DAY_MS = 86_400_000;

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function keyFromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

function streaks(activeDays: Set<string>, today: string) {
  const todayNumber = dayNumber(today);
  let cursor = activeDays.has(today) ? todayNumber : todayNumber - 1;
  let current = 0;
  while (activeDays.has(keyFromDayNumber(cursor))) {
    current += 1;
    cursor -= 1;
  }

  const sorted = [...activeDays].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((n, i) => {
    run = i > 0 && n === sorted[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best };
}

/**
 * The last ACTIVITY_DAYS days ending today, plus streaks computed over every
 * event passed in (so the best streak is not capped by the window).
 */
export function buildActivity(
  events: ActivityEvent[],
  timeZone: string,
  now: Date = new Date(),
): Activity {
  const perDay = new Map<string, { lessons: number; answers: number }>();
  for (const event of events) {
    const key = dayKey(event.at, timeZone);
    const bucket = perDay.get(key) ?? { lessons: 0, answers: 0 };
    if (event.kind === "lesson") bucket.lessons += 1;
    else bucket.answers += 1;
    perDay.set(key, bucket);
  }

  const today = dayKey(now, timeZone);
  const todayNumber = dayNumber(today);
  const days: ActivityDay[] = [];
  for (let offset = ACTIVITY_DAYS - 1; offset >= 0; offset--) {
    const date = keyFromDayNumber(todayNumber - offset);
    const bucket = perDay.get(date) ?? { lessons: 0, answers: 0 };
    days.push({ date, ...bucket, total: bucket.lessons + bucket.answers });
  }

  const { current, best } = streaks(new Set(perDay.keys()), today);
  return { days, currentStreak: current, bestStreak: best };
}
