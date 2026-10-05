"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="max-w-sm w-full text-center px-4">
          <h2 className="text-lg font-medium mb-2">Something went wrong</h2>
          <p className="text-sm text-neutral-500 mb-6">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
