export default function RootLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <svg width={80} height={80} viewBox="0 0 40 40" fill="none">
          <path d="M20 36V18" stroke="#B5553A" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M20 22C14 22 10 18 10 14C15 14 20 16 20 22Z" fill="#B5553A" />
          <path d="M20 22C26 22 30 18 30 14C25 14 20 16 20 22Z" fill="#B5553A" opacity="0.85" />
          <path d="M20 18C15 18 12 14 12 10C16 10 20 12 20 18Z" fill="#B5553A" opacity="0.7" />
          <path d="M20 18C25 18 28 14 28 10C24 10 20 12 20 18Z" fill="#B5553A" opacity="0.7" />
          <circle cx="20" cy="8" r="2.5" fill="#B5553A" />
        </svg>
        <p className="text-lg font-semibold text-terra">Freshcast</p>
      </div>
    </div>
  );
}
