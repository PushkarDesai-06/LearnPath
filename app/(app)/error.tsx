"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/components/ui/empty";

/**
 * Error boundary for the signed-in app. Keeps the topbar (it lives in the root
 * layout) so the learner can still navigate, and offers a retry of the segment.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl py-16">
      <Empty className="border-border/60 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <h1 className="font-heading text-lg font-medium tracking-tight">Something went wrong</h1>
          <EmptyDescription>
            This page didn&apos;t load. Your progress is saved; try again, or head back to your topics.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Button variant="secondary" asChild>
            <Link href="/topics">Your topics</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}
