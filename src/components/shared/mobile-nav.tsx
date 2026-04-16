"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", labelKey: "home" as const, icon: "⌂" },
  { href: "/sales", labelKey: "logSales" as const, icon: "+" },
  { href: "/chat", labelKey: "chat" as const, icon: "💬" },
  { href: "/sales/history", labelKey: "history" as const, icon: "☰" },
  { href: "/products", labelKey: "products" as const, icon: "▤" },
];

export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" &&
              tab.href !== "/sales" &&
              pathname.startsWith(tab.href));

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
