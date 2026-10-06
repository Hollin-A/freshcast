"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchWithMeta } from "@/lib/api-client";
import type { PaginationMeta, ParsedItem } from "@freshcast/shared";

type SalesEntry = {
  id: string;
  date: string;
  inputMethod: string;
  rawInput: string | null;
  receiptKey?: string | null;
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
      const { data, meta } = await apiFetchWithMeta<SalesEntry[], PaginationMeta>(
        `/api/sales?${params}`,
        undefined,
        { fallbackMessage: "Failed to fetch sales" }
      );
      return { entries: data, total: meta.total };
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
      return apiFetch<{ parsed: ParsedItem[]; unmatched: string[] }>(
        "/api/sales/parse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        },
        { fallbackMessage: "Failed to parse input" }
      );
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
      receiptKey?: string | null;
      items: { productId: string; quantity: number; unit?: string | null }[];
    }) => {
      return apiFetch<SalesEntry>(
        "/api/sales",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        { fallbackMessage: "Failed to save sales" }
      );
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
      return apiFetch<{ message: string }>(
        `/api/sales/${id}`,
        { method: "DELETE" },
        { fallbackMessage: "Failed to delete entry" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
