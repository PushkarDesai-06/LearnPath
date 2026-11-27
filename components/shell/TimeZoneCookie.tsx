"use client";

import { useEffect } from "react";
import { COOKIE_MAX_AGE } from "@/components/shell/constants";

const TIME_ZONE_COOKIE = "tz";

function readCookie(name: string) {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  const raw = match.slice(name.length + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Keeps the `tz` cookie in sync with the browser so server rendered dates use the learner's day. */
export function TimeZoneCookie() {
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone || readCookie(TIME_ZONE_COOKIE) === zone) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);
  return null;
}
