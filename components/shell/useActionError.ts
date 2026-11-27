"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiClientError } from "@/lib/client/api";

/** Reports a failed mutation: sign in again on 401, otherwise the API's own message. */
export function useActionError() {
  const router = useRouter();
  return useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiClientError && error.status === 401) {
        router.push("/login");
        return;
      }
      toast.error(error instanceof Error && error.message ? error.message : fallback);
    },
    [router],
  );
}
