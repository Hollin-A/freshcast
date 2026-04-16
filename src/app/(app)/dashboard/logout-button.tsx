"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SettingsLink() {
  return (
    <Link href="/settings">
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
      >
        ⚙ Settings
      </Button>
    </Link>
  );
}
