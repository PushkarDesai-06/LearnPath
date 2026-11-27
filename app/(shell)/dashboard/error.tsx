"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";

export default function DashboardError({
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
    <>
      <PageHeader breadcrumbs={[{ label: "Dashboard" }]} />
      <PageContainer>
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-16 text-center">
          <TriangleAlert className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            The dashboard could not load. Your progress is safe.
          </p>
          <Button onClick={() => retry()}>Try again</Button>
        </div>
      </PageContainer>
    </>
  );
}
