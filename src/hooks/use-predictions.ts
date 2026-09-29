"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiRequestError } from "@/lib/api-client";

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
      try {
        return await apiFetch<DayForecast>("/api/predictions?horizon=day", undefined, {
          fallbackMessage: "Failed to fetch predictions",
        });
      } catch (err) {
        // 422: not enough sales history yet
        if (err instanceof ApiRequestError && err.status === 422) {
          return null as unknown as DayForecast;
        }
        throw err;
      }
    },
    retry: false,
  });
}
