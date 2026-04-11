"use client";

import { useQuery } from "@tanstack/react-query";

type DayForecast = {
  forecastDate: string;
  predictions: {
    product: string;
    productId: string;
    predictedQuantity: number;
    unit: string | null;
    confidence: number;
  }[];
  dataPoints: number;
  generatedAt: string;
};

export function useDayPredictions() {
  return useQuery<DayForecast>({
    queryKey: ["predictions", "day"],
    queryFn: async () => {
      const res = await fetch("/api/predictions?horizon=day");
      if (res.status === 422) return null as unknown as DayForecast;
      if (!res.ok) throw new Error("Failed to fetch predictions");
      return res.json();
    },
    retry: false,
  });
}
