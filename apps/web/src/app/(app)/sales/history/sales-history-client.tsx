"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesList, useDeleteSales } from "@/hooks/use-sales";

export function SalesHistoryClient() {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const { data, isLoading } = useSalesList();
  const deleteMutation = useDeleteSales();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("deleted"));
      setConfirmingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"));
    }
  }

  if (isLoading) {
    return (
      <div className="px-5 pt-14">
        <Skeleton className="mb-1.5 h-4 w-20 rounded" />
        <Skeleton className="mb-6 h-8 w-40 rounded" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="mb-3 h-24 w-full rounded-2xl" />)}
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    const dateKey = new Date(entry.date).toISOString().split("T")[0];
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(entry);
  }

  const totalEntries = entries.length;

  return (
    <>
      <div className="px-5 pt-14 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sales log</p>
        <h1 className="mt-1 font-serif text-[32px] font-medium tracking-tight text-foreground">Your history</h1>
      </div>

      {totalEntries > 0 && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
          <span className="font-serif text-[32px] font-medium tracking-tight leading-none text-primary">{totalEntries}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Entries logged</p>
            <p className="text-xs text-muted-foreground">Keep it up.</p>
          </div>
          <Badge
            variant="inverse"
            className="cursor-pointer"
            onClick={() => window.open("/api/sales/export", "_blank")}
          >
            Export CSV
          </Badge>
        </div>
      )}

      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <div className="px-4">
          {Array.from(grouped.entries()).map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <p className="mb-2.5 mt-4 font-serif text-base font-medium text-foreground">
                {new Date(dateKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {dayEntries.length > 1 && (
                  <span className="ml-2 text-xs text-muted-foreground">· {dayEntries.length} entries</span>
                )}
              </p>
              <div className="flex flex-col gap-2.5">
                {dayEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold text-soft-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <Badge variant={entry.inputMethod === "NATURAL_LANGUAGE" ? "default" : "success"}>
                          {entry.inputMethod === "NATURAL_LANGUAGE" ? "Typed" : "Tapped"}
                        </Badge>
                        {entry.receiptKey && <Badge variant="warning">From receipt</Badge>}
                      </div>
                      {confirmingId === entry.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? "..." : "Delete"}
                          </Button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmingId(entry.id)}
                          className="text-[13px] text-muted-foreground"
                        >
                          •••
                        </button>
                      )}
                    </div>
                    {entry.rawInput && (
                      <div className="mb-3 rounded-r-lg border-l-2 border-highlight bg-highlight/8 py-2.5 pl-3 pr-3">
                        <p className="font-serif text-[13px] italic leading-relaxed text-soft-foreground">
                          {entry.rawInput}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                      {entry.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-foreground">{item.product.name}</span>
                          <span className="font-mono text-xs font-semibold text-soft-foreground">
                            {item.quantity} <span className="font-normal text-faint-foreground">{item.unit || ""}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
