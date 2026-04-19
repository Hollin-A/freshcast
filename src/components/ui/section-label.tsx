import { cn } from "@/lib/utils";

interface SectionLabelProps {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, trailing, className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-baseline justify-between px-5 my-4", className)}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
        {children}
      </span>
      {trailing && (
        <span className="text-[13px] font-semibold text-terra">{trailing}</span>
      )}
    </div>
  );
}
