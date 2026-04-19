"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

function IconHome({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-6h-6v6H5a2 2 0 01-2-2v-9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}

function IconLog({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 6h12M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M19 15v6M16 18h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

function IconHistory({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 4v-4H6a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    </svg>
  );
}

function IconMore({ className }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="6" cy="12" r="1.8" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
      <circle cx="18" cy="12" r="1.8" fill="currentColor"/>
    </svg>
  );
}

const tabs = [
  { href: "/dashboard", labelKey: "home" as const, icon: IconHome },
  { href: "/sales", labelKey: "logSales" as const, icon: IconLog },
  { href: "/sales/history", labelKey: "history" as const, icon: IconHistory },
  { href: "/chat", labelKey: "chat" as const, icon: IconChat },
  { href: "/settings", labelKey: "more" as const, icon: IconMore },
];

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-cream/86 backdrop-blur-xl backdrop-saturate-160 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" &&
              tab.href !== "/sales" &&
              pathname.startsWith(tab.href));

          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-[10.5px] font-semibold transition-colors",
                isActive
                  ? "text-terra"
                  : "text-mute2"
              )}
            >
              <Icon />
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
