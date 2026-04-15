export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-4xl mb-4">📡</p>
        <p className="text-lg font-medium mb-2">You&apos;re offline</p>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </div>
    </div>
  );
}
