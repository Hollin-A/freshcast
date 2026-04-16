"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesList, useDeleteSales } from "@/hooks/use-sales";

export function SalesHistoryClient() {
  const t = useTranslations("sales");
  const tc = useTranslations("common");
  const { data, isLoading } = useSalesList();
  const deleteMutation = useDeleteSales();

  async function handleDelete(id: string) {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"));
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold mb-4">{t("history")}</h1>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{t("history")}</h1>
        {entries.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.open("/api/sales/export", "_blank");
            }}
          >
            Export CSV
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">{t("noHistory")}</p>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                {new Date(dateKey).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {dayEntries.length > 1 && (
                  <span className="ml-2 text-xs">({t("entries", { count: dayEntries.length })})</span>
                )}
              </h2>
              <div className="space-y-2">
                {dayEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {entry.inputMethod === "NATURAL_LANGUAGE" ? "NL" : "Manual"}
                          </Badge>
                          <Button variant="ghost" size="sm" className="text-xs text-destructive h-6 px-2" onClick={() => handleDelete(entry.id)} disabled={deleteMutation.isPending}>
                            {tc("delete")}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {entry.rawInput && (
                        <p className="text-xs text-muted-foreground italic mb-2 pb-2 border-b">&ldquo;{entry.rawInput}&rdquo;</p>
                      )}
                      <div className="space-y-1">
                        {entry.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.product.name}</span>
                            <span className="text-muted-foreground">{item.quantity}{item.unit ? ` ${item.unit}` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
