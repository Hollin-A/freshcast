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

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4">Sales History</h1>
      {entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">
          No sales logged yet. Start by logging your first sale.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {new Date(entry.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {entry.inputMethod === "NATURAL_LANGUAGE" ? "NL" : "Manual"}
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
      )}
    </>
  );
}
