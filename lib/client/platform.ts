"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function detectMac() {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad/i.test(platform);
}

/** Server and first client render report false, so markup never mismatches. */
export function useIsMac() {
  return useSyncExternalStore(subscribe, detectMac, () => false);
}
