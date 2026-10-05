"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

type Product = {
  id: string;
  name: string;
  defaultUnit: string | null;
  isActive: boolean;
  avgPerDay: number | null;
  trend: number | null;
};

// POST/PATCH /api/products return the product without list analytics.
type ProductRecord = Omit<Product, "avgPerDay" | "trend">;

export function useProducts(active = true) {
  return useQuery<{ products: Product[] }>({
    queryKey: ["products", { active }],
    queryFn: async () => {
      const products = await apiFetch<Product[]>(`/api/products?active=${active}`, undefined, {
        fallbackMessage: "Failed to fetch products",
      });
      return { products };
    },
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; defaultUnit?: string }) => {
      return apiFetch<ProductRecord>(
        "/api/products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        { fallbackMessage: "Failed to add product" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      defaultUnit?: string;
      isActive?: boolean;
    }) => {
      return apiFetch<ProductRecord>(
        "/api/products",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
        { fallbackMessage: "Failed to update product" }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
