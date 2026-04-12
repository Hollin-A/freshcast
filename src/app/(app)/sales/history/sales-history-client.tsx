"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSalesList } from "@/hooks/use-sales";

export function SalesHistoryClient() {
  const { data, isLoading } = useSalesList();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold mb-4">Sales History</h1>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const entries = data?.entries ?? [];

  // Group entries by date
  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    const dateKey = new Date(entry.date).toISOString().split("T")[0];
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(entry);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Sales History</h1>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No sales logged yet. Start by logging your first sale.
        </p>
      ) : (
        <div className="space-y-5">
          {Array.from(grouped.entries()).map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <h2 className="text-sm font-medium text-muted-foreground mb-2">
                {new Date(dateKey).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {dayEntries.length > 1 && (
                  <span className="ml-2 text-xs">
                    ({dayEntries.length} entries)
                  </span>
                )}
              </h2>
              <div className="space-y-2">
                {dayEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString(
                            "en-US",
                            { hour: "numeric", minute: "2-digit" }
                          )}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {entry.inputMethod === "NATURAL_LANGUAGE"
                            ? "NL"
                            : "Manual"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {entry.rawInput && (
                        <p className="text-xs text-muted-foreground italic mb-2 pb-2 border-b">
                          &ldquo;{entry.rawInput}&rdquo;
                        </p>
                      )}
                      <div className="space-y-1">
                        {entry.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex justify-between text-sm"
                          >
                            <span>{item.product.name}</span>
                            <span className="text-muted-foreground">
                              {item.quantity}
                              {item.unit ? ` ${item.unit}` : ""}
                            </span>
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
