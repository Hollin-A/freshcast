"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { ForecastDetail } from "@/components/shared/forecast-detail";

export function DashboardClient() {
  const { data, isLoading } = useDashboard();
  const queryClient = useQueryClient();
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4 px-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  if (!data.hasAnySales) {
    return (
      <div className="mx-4 rounded-2xl border border-line bg-paper p-8 text-center">
        <p className="font-serif text-lg font-medium text-ink">No sales logged yet</p>
        <p className="mt-1 text-sm text-muted-warm">
          Log your first sales to see insights here
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <Link href="/sales">
            <Button size="lg">Log your first sale</Button>
          </Link>
          <Button
            variant="secondary"
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
          <p className="text-xs text-muted-warm">
            Sample data to preview the full dashboard experience
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selectedProduct && data.forecast && (() => {
        const pred = data.forecast.predictions.find((p) => p.product === selectedProduct);
        const weeklyProduct = data.weeklyForecast?.find((w) => w.product === selectedProduct);
        if (!pred) return null;
        return (
          <ForecastDetail
            product={pred.product}
            predictedQuantity={pred.predictedQuantity}
            unit={pred.unit}
            confidence={pred.confidence}
            forecastDate={data.forecast.forecastDate}
            weeklyData={weeklyProduct}
            onClose={() => setSelectedProduct(null)}
          />
        );
      })()}
      {data.totalEntries < 30 && (
        <PredictionProgressBar entries={data.totalEntries} />
      )}
      {data.forecast && data.forecast.predictions.length > 0 && (
        <ForecastHero forecast={data.forecast} onSelectProduct={setSelectedProduct} />
      )}
      {data.forecast && <SpikeAlertCard forecast={data.forecast} weekProducts={data.topProducts} />}
      <TodayStatus data={data.todaySummary} />
      {data.weeklyForecast && data.weeklyForecast.length > 0 && (
        <WeeklyForecastCard predictions={data.weeklyForecast} />
      )}
      <WeekStory data={data.weekSummary} />
      {data.topProducts.length > 0 && (
        <TopProducts products={data.topProducts} />
      )}
      {data.insights.length > 0 && (
        <Insights insights={data.insights} lastUpdated={data.lastUpdated} />
      )}
    </div>
  );
}

function PredictionProgressBar({ entries }: { entries: number }) {
  const tiers = [
    { min: 0, max: 4, label: "Log 5 days to unlock predictions", color: "bg-terra/40" },
    { min: 5, max: 14, label: "Basic predictions active", color: "bg-harvest/60" },
    { min: 15, max: 29, label: "Predictions improving", color: "bg-olive/50" },
    { min: 30, max: Infinity, label: "Predictions are reliable", color: "bg-olive" },
  ];

  const currentTier = tiers.find((t) => entries >= t.min && entries <= t.max) || tiers[0];
  const progress = Math.min((entries / 30) * 100, 100);

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">{currentTier.label}</span>
        <span className="font-mono text-xs text-muted-warm">{entries} entries</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-shell">
        <div
          className={`h-full rounded-full transition-all duration-500 ${currentTier.color}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ForecastHero({
  forecast,
  onSelectProduct,
}: {
  forecast: {
    forecastDate: string;
    predictions: {
      product: string;
      productId: string;
      predictedQuantity: number;
      unit: string | null;
      confidence: number;
      holidayAdjusted?: boolean;
      pastWeek?: number[];
      recentAvg?: number;
      trend?: string;
      breakdown?: { weekdayAvg: number; recentAvg: number; holidayMultiplier: number };
    }[];
    dataPoints: number;
    holiday?: { name: string; type: string } | null;
  };
  onSelectProduct: (product: string) => void;
}) {
  const dateLabel = new Date(forecast.forecastDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Compute overall trend for subtitle
  const trendsWithAvg = forecast.predictions
    .filter((p) => p.recentAvg && p.recentAvg > 0)
    .map((p) => ((p.predictedQuantity - (p.recentAvg || 0)) / (p.recentAvg || 1)) * 100);
  const avgTrend = trendsWithAvg.length > 0
    ? Math.round(trendsWithAvg.reduce((s, v) => s + v, 0) / trendsWithAvg.length)
    : 0;

  function handlePrepList() {
    const lines = forecast.predictions
      .slice(0, 10)
      .map((p) => `${p.product}: ~${p.predictedQuantity} ${p.unit || "units"}`)
      .join("\n");
    const text = `Prep list for ${dateLabel}\n\n${lines}`;
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Prep list copied to clipboard");
    });
  }

  function handleShare() {
    const lines = forecast.predictions
      .slice(0, 10)
      .map((p) => `${p.product}: ~${p.predictedQuantity} ${p.unit || "units"}`)
      .join("\n");
    const text = `Freshcast prep list for ${dateLabel}\n\n${lines}`;
    if (navigator.share) {
      navigator.share({ title: "Freshcast Prep List", text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Copied to clipboard");
      });
    }
  }

  return (
    <div className="mx-4 relative overflow-hidden rounded-2xl bg-linear-to-br from-ink to-[#2d2418] p-5 text-cream">
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-clay">
            Prep for tomorrow
          </p>
          <p className="mt-1 font-serif text-[22px] font-medium tracking-tight">
            {dateLabel}
          </p>
          <p className="mt-0.5 text-[13px] text-cream/60">
            {forecast.holiday
              ? `📅 ${forecast.holiday.name}`
              : avgTrend !== 0
                ? `Expect ${Math.abs(avgTrend)}% ${avgTrend > 0 ? "above" : "below"} average`
                : "Based on your recent patterns"}
          </p>
        </div>
        {forecast.holiday && (
          <Badge variant="gold" className="shrink-0">
            {forecast.holiday.type === "pre-holiday" ? "High day" : forecast.holiday.type}
          </Badge>
        )}
      </div>
      <div className="my-5 h-px bg-cream/12" />
      <div className="flex flex-col gap-3.5">
        {forecast.predictions.slice(0, 5).map((p, i) => {
          const sparkData = p.pastWeek ?? [];
          const sparkMax = Math.max(...sparkData, 1);
          return (
            <button
              key={i}
              onClick={() => onSelectProduct(p.product)}
              className="flex w-full items-center gap-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-cream">{p.product}</p>
                <p className="font-mono text-[10.5px] text-cream/50 tracking-wide">
                  vs 7d avg · {Math.round(p.confidence * 100)}% confident
                </p>
              </div>
              {sparkData.length > 0 && (
                <div className="flex items-end gap-px" style={{ width: 56, height: 22 }}>
                  {sparkData.map((v, si) => (
                    <div
                      key={si}
                      className="flex-1 rounded-[1px] bg-cream/35"
                      style={{ height: `${Math.max((v / sparkMax) * 100, 8)}%` }}
                    />
                  ))}
                </div>
              )}
              <div className="text-right min-w-[80px]">
                <span className="font-serif text-2xl font-medium tracking-tight text-clay">
                  {p.predictedQuantity}
                </span>
                <p className="text-[11px] text-cream/60">
                  {p.unit || "units"}
                  {p.trend && (
                    <span className="ml-1 text-sage">{p.trend}</span>
                  )}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <div className="my-5 h-px bg-cream/12" />
      <div className="flex gap-2.5">
        <button
          onClick={handlePrepList}
          className="flex h-11 flex-1 items-center justify-center rounded-full bg-clay font-semibold text-sm text-ink"
        >
          Use as prep list
        </button>
        <button
          onClick={handleShare}
          className="flex h-11 items-center justify-center rounded-full border border-cream/30 px-5 text-sm font-medium text-cream"
        >
          Share
        </button>
      </div>
    </div>
  );
}

function TodayStatus({
  data,
}: {
  data: {
    date: string;
    totalItems: number;
    totalQuantity: number;
    items: { product: string; quantity: number; unit: string | null }[];
  };
}) {
  const dayLabel = new Date(data.date).toLocaleDateString("en-US", { weekday: "long" });

  if (data.totalItems === 0) {
    return (
      <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
              Today · {dayLabel}
            </p>
            <p className="mt-1 font-serif text-lg font-medium text-ink">
              You haven&apos;t logged yet
            </p>
            <p className="mt-0.5 text-[13px] text-muted-warm">
              30 seconds to keep your forecast sharp.
            </p>
          </div>
          <Link href="/sales">
            <Button size="sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 2v20M2 12h20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
              Log
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
        Today · {dayLabel}
      </p>
      <p className="mt-1 font-serif text-lg font-medium text-ink">
        {data.totalItems} product{data.totalItems !== 1 ? "s" : ""} · {Math.round(data.totalQuantity)} units
      </p>
      <div className="mt-3 flex flex-col gap-1">
        {data.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-ink">{item.product}</span>
            <span className="font-mono text-xs font-semibold text-body">
              {item.quantity} <span className="text-mute2">{item.unit || ""}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekStory({
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
  const maxQty = Math.max(...data.dailyBreakdown.map((d) => d.totalQuantity), 1);
  const peakIdx = data.dailyBreakdown.reduce(
    (best, d, i) => (d.totalQuantity > (data.dailyBreakdown[best]?.totalQuantity ?? 0) ? i : best),
    0
  );
  const peakDay = data.dailyBreakdown[peakIdx];
  const peakDayName = peakDay
    ? new Date(peakDay.date).toLocaleDateString("en-US", { weekday: "long" })
    : "";

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
            This week&apos;s rhythm
          </p>
          {peakDayName && (
            <p className="mt-1.5 font-serif text-[22px] font-medium leading-tight tracking-tight text-ink">
              {peakDayName} is your<br />biggest day.
            </p>
          )}
        </div>
        {data.previousWeekQuantity > 0 && (
          <Badge variant={isUp ? "olive" : "default"}>
            {isUp ? "↑" : "↓"} {Math.abs(data.changePercent)}%
          </Badge>
        )}
      </div>
      <div className="mt-4 grid grid-cols-7 items-end gap-1" style={{ height: 90 }}>
        {data.dailyBreakdown.map((day, i) => {
          const pct = maxQty > 0 ? (day.totalQuantity / maxQty) * 100 : 0;
          const isPeak = i === peakIdx;
          return (
            <div key={day.date} className="flex h-full flex-col items-center justify-end">
              <div
                className={`w-full rounded-t ${isPeak ? "bg-terra" : "bg-shell"}`}
                style={{ height: `${Math.max(pct, 3)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {data.dailyBreakdown.map((day, i) => {
          const label = new Date(day.date).toLocaleDateString("en-US", { weekday: "narrow" });
          const isPeak = i === peakIdx;
          return (
            <span
              key={day.date}
              className={`text-center font-mono text-[10px] font-semibold ${isPeak ? "text-terra" : "text-mute2"}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const BAR_COLORS = ["bg-terra", "bg-clay", "bg-harvest", "bg-olive", "bg-plum"];

function TopProducts({
  products,
}: {
  products: {
    product: string;
    totalQuantity: number;
    unit: string | null;
    rank: number;
  }[];
}) {
  const maxQty = products[0]?.totalQuantity || 1;

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
        Top this week
      </p>
      <div className="mt-3.5 flex flex-col gap-3">
        {products.map((p, idx) => {
          const width = Math.max((p.totalQuantity / maxQty) * 100, 8);
          return (
            <div key={p.rank}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-ink">{p.product}</span>
                <span className="font-mono text-xs font-semibold text-body">
                  {p.totalQuantity} <span className="text-mute2">{p.unit || ""}</span>
                </span>
              </div>
              <div className="h-1 rounded-full bg-shell">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Insights({
  insights,
  lastUpdated,
}: {
  insights: { type: string; content: string }[];
  lastUpdated?: string;
}) {
  const ACCENT_COLORS = ["bg-olive", "bg-terra", "bg-harvest"];

  const timeLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
    : null;

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
          What Freshcast noticed
        </p>
        {timeLabel && (
          <span className="font-mono text-[10px] text-mute2">updated {timeLabel}</span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-3.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex gap-3">
            <div className={`w-[3px] shrink-0 rounded-full ${ACCENT_COLORS[i % ACCENT_COLORS.length]}`} />
            <div>
              <p className="font-serif text-base font-medium tracking-tight text-ink">
                {insight.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <div className="mx-4 rounded-2xl border border-harvest/30 bg-harvest/8 p-4">
      <div className="flex flex-col gap-1">
        {spikes.map((spike, i) => (
          <p key={i} className="text-sm text-ink">
            📈 Strong day ahead for{" "}
            <span className="font-semibold">{spike.product}</span> — ~{spike.predicted}
            {spike.unit ? ` ${spike.unit}` : ""} vs avg ~{spike.average}
          </p>
        ))}
      </div>
    </div>
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

  const topProducts = predictions
    .map((p) => ({
      ...p,
      weekTotal: p.daily.reduce((s, d) => s + d.predictedQuantity, 0),
    }))
    .sort((a, b) => b.weekTotal - a.weekTotal)
    .slice(0, 3);

  return (
    <div className="mx-4 rounded-2xl border border-line bg-paper p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
        Next week
      </p>
      {strongestDay && (
        <p className="mt-1 font-serif text-base font-medium text-ink">
          {strongestDay} looks strongest
        </p>
      )}
      <div className="mt-3 flex flex-col gap-3">
        {topProducts.map((product) => {
          const maxQty = Math.max(...product.daily.map((d) => d.predictedQuantity), 1);
          return (
            <div key={product.product}>
              <p className="mb-1 text-sm font-medium text-ink">
                {product.product}
                {product.unit && (
                  <span className="ml-1 text-xs text-muted-warm">({product.unit})</span>
                )}
              </p>
              <div className="flex gap-1">
                {product.daily.map((day) => {
                  const barHeight = Math.max(
                    Math.round((day.predictedQuantity / maxQty) * 32),
                    3
                  );
                  return (
                    <div
                      key={day.date}
                      className="flex flex-1 flex-col items-center justify-end gap-0.5"
                      style={{ height: 44 }}
                    >
                      <span className="font-mono text-[9px] text-mute2">
                        {day.predictedQuantity}
                      </span>
                      <div
                        className="w-full rounded-sm bg-terra/25"
                        style={{ height: barHeight }}
                      />
                      <span className="font-mono text-[9px] text-mute2">
                        {day.dayOfWeek.slice(0, 2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
