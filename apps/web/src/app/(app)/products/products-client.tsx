"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts, useAddProduct, useUpdateProduct } from "@/hooks/use-products";

const ACCENT_COLORS = ["bg-terra", "bg-clay", "bg-harvest", "bg-olive", "bg-plum", "bg-muted-warm"];

export function ProductsClient() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const { data, isLoading } = useProducts();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await addProduct.mutateAsync({ name, defaultUnit: newUnit.trim() || undefined });
      setNewName("");
      setNewUnit("");
      toast.success(t("added"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"));
    }
  }

  function startEdit(product: { id: string; name: string; defaultUnit: string | null }) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditUnit(product.defaultUnit || "");
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) return;
    try {
      await updateProduct.mutateAsync({ id: editingId, name: editName.trim(), defaultUnit: editUnit.trim() || undefined });
      setEditingId(null);
      toast.success(t("updated"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"));
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await updateProduct.mutateAsync({ id, isActive: false });
      toast.success(t("removed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"));
    }
  }

  const products = data?.products ?? [];

  return (
    <>
      <div className="px-5 pt-14 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
          Catalog · {products.length} products
        </p>
        <h1 className="mt-1 font-serif text-[32px] font-medium tracking-tight text-ink">
          Your products
        </h1>
      </div>

      <div className="mx-4 mb-4">
        <div className="flex gap-2 rounded-xl border border-line bg-paper p-1.5">
          <div className="flex flex-1 items-center gap-2 px-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="#7A6F5E" strokeWidth="1.6"/>
              <path d="M20 20l-4-4" stroke="#7A6F5E" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <Input
              placeholder="Add product or search…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={addProduct.isPending || !newName.trim()}
          >
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5 px-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 px-4">
          {products.map((product, idx) => (
            <div key={product.id} className="rounded-2xl border border-line bg-paper p-3.5">
              {editingId === product.id ? (
                <div className="flex items-center gap-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} placeholder="unit" className="w-20" />
                  <Button size="sm" onClick={handleSaveEdit}>{tc("save")}</Button>
                  <button onClick={() => setEditingId(null)} className="text-lg text-mute2">×</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-2 shrink-0 rounded-sm ${ACCENT_COLORS[idx % ACCENT_COLORS.length]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">{product.name}</p>
                    {product.avgPerDay !== null && product.avgPerDay > 0 && (
                      <p className="mt-0.5 font-mono text-[11px] text-muted-warm">
                        avg {product.avgPerDay} {product.defaultUnit || "units"}/day
                        {product.trend !== null && product.trend !== 0 && (
                          <span className={product.trend > 0 ? " text-olive" : " text-terra"}>
                            {" · "}{product.trend > 0 ? "+" : ""}{product.trend}%
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  {product.defaultUnit && <Badge variant="secondary">{product.defaultUnit}</Badge>}
                  <button onClick={() => startEdit(product)} className="text-xs font-semibold text-muted-warm">Edit</button>
                  <button onClick={() => handleDeactivate(product.id)} className="text-lg text-mute2">×</button>
                </div>
              )}
            </div>
          ))}
          {products.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-warm">{t("noProducts")}</p>
          )}
        </div>
      )}
    </>
  );
}
