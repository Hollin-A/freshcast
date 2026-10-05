import { cn } from "@/lib/utils";

interface BigNumberProps {
  value: string | number;
  unit?: string;
  trend?: string;
  className?: string;
}

export function BigNumber({ value, unit, trend, className }: BigNumberProps) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span className="font-serif text-[44px] font-medium tracking-tight leading-none text-ink">
        {value}
      </span>
      {unit && (
        <span className="text-[13px] font-semibold tracking-wide text-muted-warm">
          {unit}
        </span>
      )}
      {trend && (
        <span
          className={cn(
            "ml-1 font-mono text-[11px] font-semibold",
            trend.startsWith("+") ? "text-olive" : "text-terra"
          )}
        >
          {trend}
        </span>
      )}
    </div>
  );
}
