export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[oklch(0.98_0.003_90)]">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt="BizSense"
          width={80}
          height={80}
          className="rounded-2xl"
        />
        <p className="text-lg font-semibold text-[oklch(0.55_0.14_168)]">
          BizSense
        </p>
      </div>
    </div>
  );
}
