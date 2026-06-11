"use client";

// The learning path is now part of the Dashboard (one navigable hub). This page
// just redirects any old /curriculum?id= links to /dashboard?id=.
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

function Redirect() {
  const router = useRouter();
  const id = useSearchParams().get("id");
  useEffect(() => {
    router.replace(id ? `/dashboard?id=${id}` : "/dashboard");
  }, [router, id]);
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}

export default function CurriculumPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      }
    >
      <Redirect />
    </Suspense>
  );
}
