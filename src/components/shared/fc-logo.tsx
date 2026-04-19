interface FCLogoProps {
  size?: number;
}

function FCMark({ size = 24, color = "#B5553A" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 36V18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M20 22C14 22 10 18 10 14C15 14 20 16 20 22Z" fill={color} />
      <path d="M20 22C26 22 30 18 30 14C25 14 20 16 20 22Z" fill={color} opacity="0.85" />
      <path d="M20 18C15 18 12 14 12 10C16 10 20 12 20 18Z" fill={color} opacity="0.7" />
      <path d="M20 18C25 18 28 14 28 10C24 10 20 12 20 18Z" fill={color} opacity="0.7" />
      <circle cx="20" cy="8" r="2.5" fill={color} />
    </svg>
  );
}

export function FCLogo({ size = 20 }: FCLogoProps) {
  return (
    <div className="inline-flex items-center gap-2">
      <FCMark size={size + 4} />
      <span
        className="font-serif font-semibold tracking-tight text-ink"
        style={{ fontSize: size }}
      >
        Freshcast
      </span>
    </div>
  );
}
