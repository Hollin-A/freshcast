"use client";

import { useQuery } from "@tanstack/react-query";

export type DashboardData = {
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
  insights: { type: string; content: string }[];
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
