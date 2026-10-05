import { FCLogo } from "@/components/shared/fc-logo";

interface AuthShellProps {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <>
      <div className="pt-[70px] pb-5 text-left">
        <FCLogo />
      </div>
      <div className="flex flex-1 flex-col pt-5">
        <h1 className="mt-10 font-serif text-[34px] font-medium leading-[1.05] tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2.5 max-w-[300px] text-[15px] leading-relaxed text-muted-warm">
            {subtitle}
          </p>
        )}
        <div className="mt-9 flex flex-col gap-3.5">
          {children}
        </div>
        <div className="flex-1" />
        {footer && (
          <div className="py-5 pb-6 text-center text-sm text-muted-warm">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
