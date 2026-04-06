"use client";

import { useEffect } from "react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Portal Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-xl border border-border bg-surface-primary p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-text-primary">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          An unexpected error occurred. Try refreshing or contact support if the
          problem persists.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
