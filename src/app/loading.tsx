export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="Freshcast"
          width={80}
          height={80}
          className="rounded-2xl"
        />
        <p className="text-lg font-semibold text-terra">
          Freshcast
        </p>
      </div>
    </div>
  );
}
