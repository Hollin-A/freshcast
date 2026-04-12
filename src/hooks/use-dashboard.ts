"use client";

import { useQuery } from "@tanstack/react-query";

export type DashboardData = {
  hasAnySales: boolean;
  totalEntries: number;
  todaySummary: {
    date: string;
    totalItems: number;
    totalQuantity: number;
    items: { product: string; quantity: number; unit: string | null }[];
  };
  weekSummary: {
    totalQuantity: number;
    previousWeekQuantity: number;
    changePercent: number;
    dailyBreakdown: { date: string; totalQuantity: number }[];
  };
  topProducts: {
    product: string;
    productId: string;
    totalQuantity: number;
    unit: string | null;
    rank: number;
  }[];
  forecast: {
    forecastDate: string;
    predictions: {
      product: string;
      predictedQuantity: number;
      unit: string | null;
      confidence: number;
    }[];
    dataPoints: number;
  } | null;
  weeklyForecast: {
    product: string;
    productId: string;
    unit: string | null;
    daily: {
      date: string;
      dayOfWeek: string;
      predictedQuantity: number;
    }[];
  }[] | null;
  insights: { id?: string; type: string; content: string }[];
  lastUpdated: string;
};

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });
}
