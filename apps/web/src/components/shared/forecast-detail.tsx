"use client";

import { Button } from "@/components/ui/button";

interface ForecastDetailProps {
  product: string;
  predictedQuantity: number;
  unit: string | null;
  confidence: number;
  forecastDate: string;
  weeklyData?: {
    daily: { date: string; dayOfWeek: string; predictedQuantity: number }[];
  };
  pastWeek?: number[];
  breakdown?: {
    weekdayAvg: number;
    recentAvg: number;
    holidayMultiplier: number;
  };
  dataPoints?: number;
  onClose: () => void;
}

export function ForecastDetail({
  product,
  predictedQuantity,
  unit,
  confidence,
  forecastDate,
  weeklyData,
  pastWeek,
  breakdown,
  dataPoints,
  onClose,
}: ForecastDetailProps) {
  const dateLabel = new Date(forecastDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const confidencePct = Math.round(confidence * 100);
  const unitLabel = unit || "units";
  const forecastDays = weeklyData?.daily ?? [];
  const pastDays = pastWeek ?? [];

  // Build 14-day chart data: 7 past (actual) + 7 forecast
  const allBars = [
    ...pastDays.map((v) => ({ value: v, type: "past" as const })),
    ...forecastDays.map((d) => ({ value: d.predictedQuantity, type: "forecast" as const })),
  ];
  const chartMax = Math.max(...allBars.map((b) => b.value), 1);

  // Day labels for the chart
  const pastLabels = pastDays.length > 0
    ? Array.from({ length: pastDays.length }, (_, i) => {
        const d = new Date(forecastDate);
        d.setDate(d.getDate() - (pastDays.length - i));
        return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
      })
    : [];
  const forecastLabels = forecastDays.map((d) => d.dayOfWeek.slice(0, 2));
  const allLabels = [...pastLabels, ...forecastLabels];

  // Compute buffer suggestion from variance of past data
  const buffer = pastDays.length >= 3
    ? Math.max(1, Math.round(Math.sqrt(
        pastDays.reduce((s, v) => s + (v - (pastDays.reduce((a, b) => a + b, 0) / pastDays.length)) ** 2, 0) / pastDays.length
      )))
    : Math.max(1, Math.round(predictedQuantity * 0.1));

  // "Why this number" rows from real breakdown
  const whyRows: [string, string][] = [];
  if (breakdown) {
    whyRows.push(["7-day average", `${breakdown.recentAvg} ${unitLabel}`]);
    if (breakdown.weekdayAvg > 0) {
      const dayName = new Date(forecastDate).toLocaleDateString("en-US", { weekday: "long" });
      const weekdayPct = breakdown.recentAvg > 0
        ? Math.round(((breakdown.weekdayAvg - breakdown.recentAvg) / breakdown.recentAvg) * 100)
        : 0;
      whyRows.push([`${dayName} multiplier`, weekdayPct >= 0 ? `+${weekdayPct}%` : `${weekdayPct}%`]);
    }
    if (breakdown.holidayMultiplier !== 1.0) {
      const holidayPct = Math.round((breakdown.holidayMultiplier - 1) * 100);
      whyRows.push(["Holiday adjustment", holidayPct >= 0 ? `+${holidayPct}%` : `${holidayPct}%`]);
    }
  }
  whyRows.push(["Confidence", `${confidencePct}%${dataPoints ? ` · ${dataPoints} entries` : ""}`]);

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-auto">
      <div className="mx-auto max-w-md pb-10">
        <div className="flex items-center justify-between px-5 pt-14 pb-2">
          <button onClick={onClose} className="text-[15px] text-body">← Tomorrow</button>
          <button onClick={onClose} className="text-[15px] font-semibold text-terra">Close</button>
        </div>

        <div className="px-5 pt-2 pb-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
            {product} · {unitLabel}
          </p>
          <h1 className="mt-1 font-serif text-[26px] font-medium tracking-tight text-ink">
            Prep <span className="text-terra">{predictedQuantity}</span> for tomorrow.
          </h1>
        </div>

        <p className="px-5 mt-1 text-sm leading-relaxed text-muted-warm">
          {dateLabel}. {confidencePct}% confident based on your recent sales patterns.
        </p>

        {/* 14-day chart */}
        {allBars.length > 0 && (
          <div className="mx-4 mt-5 rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
                {pastDays.length > 0 ? "Past 7d → Next 7d" : "Next 7 days"}
              </p>
              <div className="flex items-center gap-3">
                {pastDays.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm bg-ink" />
                    <span className="font-mono text-[10px] text-mute2">actual</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{
                    background: "repeating-linear-gradient(135deg, #B5553A 0 2px, rgba(181,85,58,0.4) 2px 4px)",
                  }} />
                  <span className="font-mono text-[10px] text-mute2">forecast</span>
                </div>
              </div>
            </div>

            <div className="relative mt-4" style={{ height: 160 }}>
              <div
                className="grid items-end gap-1"
                style={{
                  gridTemplateColumns: `repeat(${allBars.length}, 1fr)`,
                  height: 140,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {allBars.map((bar, i) => {
                  const pct = (bar.value / chartMax) * 100;
                  const isTomorrow = bar.type === "forecast" && i === pastDays.length;
                  return (
                    <div key={i} className="relative flex h-full flex-col items-center justify-end">
                      {isTomorrow && (
                        <span className="absolute -top-4 font-mono text-[10px] font-bold text-terra whitespace-nowrap">
                          {bar.value} ↓
                        </span>
                      )}
                      <div
                        className="w-full rounded-sm"
                        style={{
                          height: `${Math.max(pct, 4)}%`,
                          background: bar.type === "past"
                            ? "#1E1A14"
                            : "repeating-linear-gradient(135deg, #B5553A 0 3px, rgba(181,85,58,0.45) 3px 6px)",
                          opacity: bar.type === "past" ? 0.85 : 0.95,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              {/* Dashed divider between past and forecast */}
              {pastDays.length > 0 && forecastDays.length > 0 && (
                <div
                  className="absolute top-0 bottom-10"
                  style={{
                    left: `calc(${(pastDays.length / allBars.length) * 100}% - 1px)`,
                    borderLeft: "1px dashed #A89B85",
                  }}
                />
              )}
              <div
                className="mt-2 grid gap-1"
                style={{ gridTemplateColumns: `repeat(${allBars.length}, 1fr)` }}
              >
                {allLabels.map((label, i) => {
                  const isTomorrow = i === pastDays.length;
                  return (
                    <span
                      key={i}
                      className={`text-center font-mono text-[10px] ${isTomorrow ? "font-bold text-terra" : "text-mute2"}`}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Why this number */}
        <div className="mx-4 mt-3 rounded-2xl border border-line bg-paper p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-warm">
            Why {predictedQuantity}
          </p>
          {whyRows.map(([k, v], i) => (
            <div
              key={k}
              className={`flex justify-between py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <span className="text-sm text-body">{k}</span>
              <span className="font-mono text-[13px] font-semibold text-ink">{v}</span>
            </div>
          ))}
        </div>

        {/* Prep card */}
        <div className="mx-4 mt-3 overflow-hidden rounded-2xl">
          <div className="bg-ink p-5 text-cream">
            <p className="text-[11px] font-bold uppercase tracking-wider text-clay">Prep plan</p>
            <p className="mt-1 font-serif text-xl font-medium tracking-tight">
              {predictedQuantity} {unitLabel} tomorrow
            </p>
            <p className="mt-0.5 text-[13px] text-cream/60">
              We suggest ±{buffer} {unitLabel} buffer for walk-ins.
            </p>
          </div>
          <div className="flex gap-2 border border-t-0 border-line bg-paper p-3.5">
            <Button className="flex-1" onClick={onClose}>Got it</Button>
            <Button variant="secondary" onClick={onClose}>Adjust</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
