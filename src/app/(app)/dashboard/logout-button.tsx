"use client";

import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("auth");

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      {t("logOut")}
    </Button>
  );
}
