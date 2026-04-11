"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard";

export function DashboardClient() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const hasData =
    data.todaySummary.totalItems > 0 ||
    data.weekSummary.totalQuantity > 0;

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium mb-2">No sales logged yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Log your first sales to see insights here
          </p>
          <Link href="/sales">
            <Button>Log your first sale</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TodaySummaryCard data={data.todaySummary} />
      <WeekTrendCard data={data.weekSummary} />
      {data.topProducts.length > 0 && (
        <TopProductsCard products={data.topProducts} />
      )}
    </div>
  );
}

function TodaySummaryCard({
  data,
}: {
  data: {
    date: string;
    totalItems: number;
    totalQuantity: number;
    items: { product: string; quantity: number; unit: string | null }[];
  };
}) {
  if (data.totalItems === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Today&apos;s Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No sales logged today.{" "}
            <Link href="/sales" className="text-primary underline">
              Log now
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Today&apos;s Sales</CardTitle>
        <CardDescription>
          {data.totalItems} product{data.totalItems !== 1 ? "s" : ""} ·{" "}
          {Math.round(data.totalQuantity)} total units
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {data.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>{item.product}</span>
              <span className="text-muted-foreground">
                {item.quantity}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeekTrendCard({
  data,
}: {
  data: {
    totalQuantity: number;
    previousWeekQuantity: number;
    changePercent: number;
    dailyBreakdown: { date: string; totalQuantity: number }[];
  };
}) {
  const isUp = data.changePercent > 0;
  const isDown = data.changePercent < 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">This Week</CardTitle>
        <CardDescription>Last 7 days vs previous week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-2xl font-semibold">
            {data.totalQuantity}
          </span>
          <span className="text-sm text-muted-foreground">units</span>
          {data.previousWeekQuantity > 0 && (
            <Badge
              variant={isUp ? "default" : isDown ? "destructive" : "secondary"}
              className="text-xs"
            >
              {isUp ? "↑" : isDown ? "↓" : "→"}{" "}
              {Math.abs(data.changePercent)}%
            </Badge>
          )}
        </div>
        <div className="flex items-end gap-1 h-16">
          {data.dailyBreakdown.map((day) => {
            const maxQty = Math.max(
              ...data.dailyBreakdown.map((d) => d.totalQuantity),
              1
            );
            const height = Math.max((day.totalQuantity / maxQty) * 100, 4);
            const dayLabel = new Date(day.date).toLocaleDateString("en-US", {
              weekday: "narrow",
            });
            return (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-sm bg-primary/20"
                  style={{ height: `${height}%` }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {dayLabel}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TopProductsCard({
  products,
}: {
  products: {
    product: string;
    totalQuantity: number;
    unit: string | null;
    rank: number;
  }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Products</CardTitle>
        <CardDescription>This week by quantity</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {products.map((p) => {
            const maxQty = products[0]?.totalQuantity || 1;
            const width = Math.max((p.totalQuantity / maxQty) * 100, 8);
            return (
              <div key={p.rank} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{p.product}</span>
                  <span className="text-muted-foreground">
                    {p.totalQuantity}
                    {p.unit ? ` ${p.unit}` : ""}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
