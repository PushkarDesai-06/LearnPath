import { cookies } from "next/headers";
import { isValidTimeZone } from "@/lib/domain/activity";

export const TIME_ZONE_COOKIE = "tz";

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The learner's IANA zone from the `tz` cookie, or UTC when absent or not a real zone. */
export async function readTimeZone(): Promise<string> {
  const raw = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  const zone = raw ? decode(raw) : "";
  return isValidTimeZone(zone) ? zone : "UTC";
}
