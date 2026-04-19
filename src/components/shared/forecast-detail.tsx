"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ForecastDetailProps {
  product: string;
  predictedQuantity: number;
  unit: string | null;
  confidence: number;
  forecastDate: string;
  weeklyData?: {
    daily: { date: string; dayOfWeek: string; predictedQuantity: number }[];
  };
  onClose: () => void;
}

export function ForecastDetail({
  product,
  predictedQuantity,
  unit,
  confidence,
  forecastDate,
  weeklyData,
  onClose,
}: ForecastDetailProps) {
  const dateLabel = new Date(forecastDate).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const confidencePct = Math.round(confidence * 100);
  const unitLabel = unit || "units";

  // Build a simple forecast bar chart from weekly data
  const forecastDays = weeklyData?.daily ?? [];
  const maxQty = Math.max(predictedQuantity, ...forecastDays.map((d) => d.predictedQuantity), 1);

  return (
    <div className="fixed inset-0 z-50 bg-cream overflow-auto">
      <div className="mx-auto max-w-md pb-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-14 pb-2">
          <button onClick={onClose} className="text-[15px] text-body">← Tomorrow</button>
          <span className="text-[15px] font-semibold text-terra">Close</span>
        </div>

        {/* Title */}
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

        {/* Forecast chart */}
        {forecastDays.length > 0 && (
          <div className="mx-4 mt-5 rounded-2xl border border-line bg-paper p-5">
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
                Next 7 days
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-sm" style={{
                    background: `repeating-linear-gradient(135deg, #B5553A 0 2px, rgba(181,85,58,0.4) 2px 4px)`,
                  }} />
                  <span className="font-mono text-[10px] text-mute2">forecast</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-1" style={{
              gridTemplateColumns: `repeat(${forecastDays.length}, 1fr)`,
              alignItems: "flex-end",
              height: 120,
            }}>
              {forecastDays.map((day, i) => {
                const pct = (day.predictedQuantity / maxQty) * 100;
                const isTomorrow = i === 0;
                return (
                  <div key={day.date} className="relative flex h-full flex-col items-center justify-end">
                    {isTomorrow && (
                      <span className="absolute -top-4 font-mono text-[10px] font-bold text-terra">
                        {day.predictedQuantity} ↓
                      </span>
                    )}
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(pct, 5)}%`,
                        background: `repeating-linear-gradient(135deg, #B5553A 0 3px, rgba(181,85,58,0.45) 3px 6px)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 grid gap-1" style={{
              gridTemplateColumns: `repeat(${forecastDays.length}, 1fr)`,
            }}>
              {forecastDays.map((day, i) => (
                <span
                  key={day.date}
                  className={`text-center font-mono text-[10px] ${i === 0 ? "font-bold text-terra" : "text-mute2"}`}
                >
                  {day.dayOfWeek.slice(0, 2)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Why this number */}
        <div className="mx-4 mt-3 rounded-2xl border border-line bg-paper p-4">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-warm">
            Why {predictedQuantity}
          </p>
          {[
            ["Confidence", `${confidencePct}%`],
            ["Unit", unitLabel],
            ["Forecast date", dateLabel],
          ].map(([k, v], i) => (
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
          <div className="bg-ink p-4.5 text-cream">
            <p className="text-[11px] font-bold uppercase tracking-wider text-clay">Prep plan</p>
            <p className="mt-1 font-serif text-xl font-medium tracking-tight">
              {predictedQuantity} {unitLabel} tomorrow
            </p>
            <p className="mt-0.5 text-[13px] text-cream/60">
              We suggest a small buffer for walk-ins.
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
