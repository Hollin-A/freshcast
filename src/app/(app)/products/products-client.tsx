"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts, useAddProduct, useUpdateProduct } from "@/hooks/use-products";

export function ProductsClient() {
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
      await addProduct.mutateAsync({
        name,
        defaultUnit: newUnit.trim() || undefined,
      });
      setNewName("");
      setNewUnit("");
      toast.success("Product added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
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
      await updateProduct.mutateAsync({
        id: editingId,
        name: editName.trim(),
        defaultUnit: editUnit.trim() || undefined,
      });
      setEditingId(null);
      toast.success("Product updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await updateProduct.mutateAsync({ id, isActive: false });
      toast.success("Product removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>Manage the products you sell</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Product name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Input
              placeholder="Unit"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="w-24"
            />
            <Button
              onClick={handleAdd}
              disabled={addProduct.isPending || !newName.trim()}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.products.map((product) => (
            <Card key={product.id}>
              <CardContent className="flex items-center gap-3 py-3">
                {editingId === product.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      placeholder="Unit"
                      className="w-24"
                    />
                    <Button size="sm" onClick={handleSaveEdit}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      ✕
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium">{product.name}</span>
                    {product.defaultUnit && (
                      <Badge variant="secondary">{product.defaultUnit}</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEdit(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeactivate(product.id)}
                    >
                      Remove
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
          {data?.products.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No products yet. Add your first one above.
            </p>
          )}
        </div>
      )}
    </>
  );
}
