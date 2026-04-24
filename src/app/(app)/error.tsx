"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm w-full rounded-2xl border border-line bg-paper p-10 text-center">
        <p className="font-serif text-lg font-medium text-ink mb-2">Something went wrong</p>
        <p className="text-sm text-muted-warm mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
