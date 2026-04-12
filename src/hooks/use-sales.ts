"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ParsedItem } from "@/services/sales-parser";

type SalesEntry = {
  id: string;
  date: string;
  inputMethod: string;
  rawInput: string | null;
  createdAt: string;
  items: {
    id: string;
    quantity: number;
    unit: string | null;
    product: { id: string; name: string };
  }[];
};

export function useSalesList(from?: string, to?: string) {
  return useQuery<{ entries: SalesEntry[]; total: number }>({
    queryKey: ["sales", { from, to }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/sales?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });
}

export function useParseSales() {
  return useMutation<
    { parsed: ParsedItem[]; unmatched: string[] },
    Error,
    string
  >({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/sales/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed to parse input");
      return res.json();
    },
  });
}

export function useSaveSales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      date: string;
      inputMethod: "NATURAL_LANGUAGE" | "MANUAL";
      rawInput?: string | null;
      items: { productId: string; quantity: number; unit?: string | null }[];
    }) => {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message || "Failed to save sales");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteSales() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message || "Failed to delete entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
