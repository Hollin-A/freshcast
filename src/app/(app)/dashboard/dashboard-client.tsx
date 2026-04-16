"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { useQueryClient } from "@tanstack/react-query";

export function DashboardClient() {
  const { data, isLoading } = useDashboard();
  const queryClient = useQueryClient();
  const [loadingDemo, setLoadingDemo] = useState(false);

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

  // State 1: Never logged any sales
  if (!data.hasAnySales) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-lg font-medium mb-2">No sales logged yet</p>
          <p className="text-sm text-muted-foreground mb-4">
            Log your first sales to see insights here
          </p>
          <div className="flex flex-col gap-3 items-center">
            <Link href="/sales">
              <Button>Log your first sale</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={loadingDemo}
              onClick={async () => {
                setLoadingDemo(true);
                try {
                  const res = await fetch("/api/demo", { method: "POST" });
                  if (!res.ok) {
                    const body = await res.json();
                    toast.error(body.error?.message || "Failed to load demo data");
                    return;
                  }
                  toast.success("Demo data loaded!");
                  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                  queryClient.invalidateQueries({ queryKey: ["sales"] });
                  queryClient.invalidateQueries({ queryKey: ["products"] });
                } catch {
                  toast.error("Something went wrong");
                } finally {
                  setLoadingDemo(false);
                }
              }}
            >
              {loadingDemo ? "Loading demo..." : "Try with demo data"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sample data to preview the full dashboard experience
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // State 2 & 3: Has historical data (may or may not have today's)
  return (
    <div className="space-y-4">
      {data.forecast && data.forecast.predictions.length > 0 && (
        <ForecastCard forecast={data.forecast} />
      )}
      {data.forecast && <SpikeAlertCard forecast={data.forecast} weekProducts={data.topProducts} />}
      {data.weeklyForecast && data.weeklyForecast.length > 0 && (
        <WeeklyForecastCard predictions={data.weeklyForecast} />
      )}
      <TodaySummaryCard data={data.todaySummary} />
      <WeekTrendCard data={data.weekSummary} />
      {data.topProducts.length > 0 && (
        <TopProductsCard products={data.topProducts} />
      )}
      {data.insights.length > 0 && (
        <InsightsCard insights={data.insights} />
      )}
      {!data.forecast && data.totalEntries > 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Log at least 5 days of sales to see demand predictions
            </p>
          </CardContent>
        </Card>
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
            You haven&apos;t logged today&apos;s sales yet.{" "}
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
        <div className="flex items-end gap-1" style={{ height: "4rem" }}>
          {data.dailyBreakdown.map((day) => {
            const maxQty = Math.max(
              ...data.dailyBreakdown.map((d) => d.totalQuantity),
              1
            );
            const barMaxHeight = 48; // px, leaving room for label
            const barHeight = Math.max(
              Math.round((day.totalQuantity / maxQty) * barMaxHeight),
              3
            );
            const dayLabel = new Date(day.date).toLocaleDateString("en-US", {
              weekday: "narrow",
            });
            return (
              <div
                key={day.date}
                className="flex flex-1 flex-col items-center justify-end gap-1"
                style={{ height: "100%" }}
              >
                <div
                  className="w-full rounded-sm bg-primary/30"
                  style={{ height: `${barHeight}px` }}
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

const CONFIDENCE_LABELS: Record<string, string> = {
  low: "Low confidence",
  moderate: "Moderate",
  good: "Good",
  high: "High confidence",
};

function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.75) return { label: CONFIDENCE_LABELS.high, color: "text-green-600" };
  if (confidence >= 0.6) return { label: CONFIDENCE_LABELS.good, color: "text-blue-600" };
  if (confidence >= 0.4) return { label: CONFIDENCE_LABELS.moderate, color: "text-amber-600" };
  return { label: CONFIDENCE_LABELS.low, color: "text-muted-foreground" };
}

function ForecastCard({
  forecast,
}: {
  forecast: {
    forecastDate: string;
    predictions: {
      product: string;
      predictedQuantity: number;
      unit: string | null;
      confidence: number;
    }[];
    dataPoints: number;
  };
}) {
  const dateLabel = new Date(forecast.forecastDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tomorrow&apos;s Forecast</CardTitle>
        <CardDescription>{dateLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {forecast.predictions.slice(0, 5).map((p, i) => {
            const conf = getConfidenceLabel(p.confidence);
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{p.product}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    ~{p.predictedQuantity}
                    {p.unit ? ` ${p.unit}` : ""}
                  </span>
                  <span className={`text-xs ${conf.color}`}>{conf.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsCard({
  insights,
}: {
  insights: { type: string; content: string }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Insights</CardTitle>
        <CardDescription>Auto-generated from your data</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-0.5 text-primary">•</span>
              <span>{insight.content}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeeklyForecastCard({
  predictions,
}: {
  predictions: {
    product: string;
    unit: string | null;
    daily: { date: string; dayOfWeek: string; predictedQuantity: number }[];
  }[];
}) {
  // Find the strongest day across all products
  const dayTotals = new Map<string, number>();
  for (const p of predictions) {
    for (const d of p.daily) {
      dayTotals.set(d.dayOfWeek, (dayTotals.get(d.dayOfWeek) ?? 0) + d.predictedQuantity);
    }
  }
  let strongestDay = "";
  let strongestQty = 0;
  for (const [day, qty] of dayTotals) {
    if (qty > strongestQty) {
      strongestDay = day;
      strongestQty = qty;
    }
  }

  // Show top 3 products
  const topProducts = predictions
    .map((p) => ({
      ...p,
      weekTotal: p.daily.reduce((s, d) => s + d.predictedQuantity, 0),
    }))
    .sort((a, b) => b.weekTotal - a.weekTotal)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Next Week</CardTitle>
        <CardDescription>
          {strongestDay && `${strongestDay} looks like your strongest day`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {topProducts.map((product) => (
            <div key={product.product}>
              <p className="text-sm font-medium mb-1">
                {product.product}
                {product.unit && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({product.unit})
                  </span>
                )}
              </p>
              <div className="flex gap-1">
                {product.daily.map((day) => {
                  const maxQty = Math.max(...product.daily.map((d) => d.predictedQuantity), 1);
                  const barHeight = Math.max(
                    Math.round((day.predictedQuantity / maxQty) * 32),
                    3
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex flex-1 flex-col items-center justify-end gap-0.5"
                      style={{ height: "44px" }}
                    >
                      <span className="text-[9px] text-muted-foreground">
                        {day.predictedQuantity}
                      </span>
                      <div
                        className="w-full rounded-sm bg-primary/25"
                        style={{ height: `${barHeight}px` }}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {day.dayOfWeek.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SpikeAlertCard({
  forecast,
  weekProducts,
}: {
  forecast: {
    predictions: {
      product: string;
      predictedQuantity: number;
      unit: string | null;
    }[];
  };
  weekProducts: { product: string; totalQuantity: number }[];
}) {
  // Find products where tomorrow's prediction is >30% above weekly daily average
  const spikes: { product: string; predicted: number; average: number; unit: string | null }[] = [];

  for (const pred of forecast.predictions) {
    const weekData = weekProducts.find((w) => w.product === pred.product);
    if (!weekData) continue;
    const dailyAvg = weekData.totalQuantity / 7;
    if (dailyAvg > 0 && pred.predictedQuantity > dailyAvg * 1.3) {
      spikes.push({
        product: pred.product,
        predicted: pred.predictedQuantity,
        average: Math.round(dailyAvg),
        unit: pred.unit,
      });
    }
  }

  if (spikes.length === 0) return null;

  return (
    <Card className="border-amber-300/50 bg-amber-50/30">
      <CardContent className="py-3">
        <div className="space-y-1">
          {spikes.map((spike, i) => (
            <p key={i} className="text-sm">
              📈 Looks like tomorrow could be a strong day for{" "}
              <span className="font-medium">{spike.product}</span> — predicted{" "}
              ~{spike.predicted}{spike.unit ? ` ${spike.unit}` : ""} vs your daily average of ~{spike.average}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
