const DAY_MS = 86_400_000;

function calendarDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayNumber(isoDay: string) {
  return Date.parse(`${isoDay}T00:00:00Z`) / DAY_MS;
}

/** "Today", "Yesterday", "3 days ago" or "Nov 3", counted in the learner's calendar days. */
export function formatRelativeDay(
  iso: string,
  timeZone: string,
  now: Date = new Date(),
) {
  const then = new Date(iso);
  const days = dayNumber(calendarDay(now, timeZone)) - dayNumber(calendarDay(then, timeZone));
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(then);
}

/** Formats a `YYYY-MM-DD` calendar day (already in the learner's zone) like "Tue, Nov 18". */
export function formatCalendarDay(isoDay: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${isoDay}T00:00:00Z`));
}

export function weekdayOf(isoDay: string) {
  return new Date(`${isoDay}T00:00:00Z`).getUTCDay();
}

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
