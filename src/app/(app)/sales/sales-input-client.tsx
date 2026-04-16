"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useProducts, useAddProduct } from "@/hooks/use-products";
import { useParseSales, useSaveSales } from "@/hooks/use-sales";
import type { ParsedItem } from "@/services/sales-parser";

type ManualItem = {
  productId: string;
  productName: string;
  quantity: string;
  unit: string | null;
};

export function SalesInputClient() {
  const router = useRouter();
  const { data: productsData } = useProducts();
  const parseMutation = useParseSales();
  const saveMutation = useSaveSales();
  const addProduct = useAddProduct();

  const [nlText, setNlText] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[] | null>(null);
  const [manualItems, setManualItems] = useState<ManualItem[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toLocaleDateString("en-CA")
  );
  const [inputMethod, setInputMethod] = useState<"NATURAL_LANGUAGE" | "MANUAL">(
    "NATURAL_LANGUAGE"
  );
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");

  const products = productsData?.products ?? [];

  // Track product list version to reset manual items when products change
  const productVersionRef = useRef(0);
  const currentProductVersion = products.map((p) => p.id).join(",");

  useEffect(() => {
    // Reset manual items whenever the product list changes
    if (currentProductVersion && currentProductVersion !== productVersionRef.current.toString()) {
      setManualItems([]);
    }
  }, [currentProductVersion]);

  // Initialize manual items from products
  function initManualItems() {
    productVersionRef.current += 1;
    setManualItems(
      products.map((p) => ({
        productId: p.id,
        productName: p.name,
        quantity: "",
        unit: p.defaultUnit,
      }))
    );
  }

  async function handleParse() {
    if (!nlText.trim()) return;
    try {
      const result = await parseMutation.mutateAsync(nlText);
      setParsedItems(result.parsed);
      setInputMethod("NATURAL_LANGUAGE");
      setShowConfirm(true);
    } catch {
      toast.error("Failed to parse input");
    }
  }

  function handleManualConfirm() {
    const filled = manualItems.filter((item) => {
      const qty = parseFloat(item.quantity);
      return !isNaN(qty) && qty > 0;
    });
    if (filled.length === 0) {
      toast.error("Please enter quantities for at least one product");
      return;
    }
    setParsedItems(
      filled.map((item) => ({
        rawText: `${item.quantity} ${item.productName}`,
        product: item.productName,
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        matched: true,
      }))
    );
    setInputMethod("MANUAL");
    setShowConfirm(true);
  }

  async function handleAddUnmatched(item: ParsedItem) {
    try {
      const newProduct = await addProduct.mutateAsync({
        name: item.product,
        defaultUnit: item.unit || undefined,
      });
      setParsedItems((prev) =>
        prev?.map((p) =>
          p.product === item.product
            ? { ...p, productId: newProduct.id, matched: true }
            : p
        ) ?? null
      );
      toast.success(`Added "${item.product}" to your products`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add product");
    }
  }

  function updateParsedQuantity(index: number, quantity: number) {
    setParsedItems((prev) =>
      prev?.map((p, i) => (i === index ? { ...p, quantity } : p)) ?? null
    );
  }

  function removeParsedItem(index: number) {
    setParsedItems((prev) => prev?.filter((_, i) => i !== index) ?? null);
  }

  async function handleSave() {
    if (!parsedItems || parsedItems.length === 0) return;

    const unmatchedItems = parsedItems.filter((p) => !p.productId);
    if (unmatchedItems.length > 0) {
      toast.error("Please add all new products before saving");
      return;
    }

    // Filter out zero or negative quantities
    const validItems = parsedItems.filter((p) => p.quantity > 0);
    if (validItems.length === 0) {
      toast.error("All items have zero quantity. Please enter valid quantities.");
      return;
    }

    const today = selectedDate;
    try {
      await saveMutation.mutateAsync({
        date: today,
        inputMethod,
        rawInput: inputMethod === "NATURAL_LANGUAGE" ? nlText : null,
        items: validItems.map((p) => ({
          productId: p.productId!,
          quantity: p.quantity,
          unit: p.unit,
        })),
      });
      toast.success("Sales saved");
      setNlText("");
      setParsedItems(null);
      setShowConfirm(false);
      setManualItems([]);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  }

  // Confirmation screen
  if (showConfirm && parsedItems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Confirm your sales</CardTitle>
          <CardDescription>
            Review and edit before saving. Date: {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {parsedItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded-lg border p-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.product}</span>
                  {!item.matched && (
                    <Badge variant="outline" className="text-amber-600">
                      New
                    </Badge>
                  )}
                </div>
                {item.unit && (
                  <span className="text-xs text-muted-foreground">
                    {item.unit}
                  </span>
                )}
              </div>
              <Input
                type="number"
                value={item.quantity}
                onChange={(e) =>
                  updateParsedQuantity(index, parseFloat(e.target.value) || 0)
                }
                className="w-20 text-center"
                min={0}
                step="any"
              />
              {!item.matched && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddUnmatched(item)}
                >
                  Add
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeParsedItem(index)}
              >
                ✕
              </Button>
            </div>
          ))}
          {parsedItems.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">
              No items to save.
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowConfirm(false);
                setParsedItems(null);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={
                saveMutation.isPending ||
                parsedItems.length === 0 ||
                parsedItems.some((p) => !p.productId)
              }
            >
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Input screen
  return (
    <>
      <div className="mb-4 min-w-0">
        <Label className="text-sm text-muted-foreground mb-1 block">Date</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toLocaleDateString("en-CA")}
          className="w-full"
          style={{ minWidth: 0, width: "100%", boxSizing: "border-box", WebkitAppearance: "none" }}
        />
      </div>
      <Tabs
      defaultValue="nl"
      onValueChange={(v) => {
        if (v === "manual") initManualItems();
      }}
    >
      <TabsList className="w-full">
        <TabsTrigger value="nl" className="flex-1">
          Type it out
        </TabsTrigger>
        <TabsTrigger value="manual" className="flex-1">
          Enter manually
        </TabsTrigger>
      </TabsList>

      <TabsContent value="nl">
        <Card>
          <CardHeader>
            <CardTitle>Log today&apos;s sales</CardTitle>
            <CardDescription>
              Type what you sold in plain language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="e.g., sold 20 eggs, 30kg beef, and 10 milk bottles"
              value={nlText}
              onChange={(e) => setNlText(e.target.value)}
            />
            <Button
              className="w-full"
              onClick={handleParse}
              disabled={parseMutation.isPending || !nlText.trim()}
            >
              {parseMutation.isPending ? "Parsing..." : "Parse"}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="manual">
        <Card>
          <CardHeader>
            <CardTitle>Log today&apos;s sales</CardTitle>
            <CardDescription>
              Enter quantities for each product
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manualItems.map((item, index) => (
              <div key={item.productId} className="flex items-center gap-2">
                <Label className="flex-1 text-sm">{item.productName}</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={item.quantity}
                  onChange={(e) =>
                    setManualItems((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, quantity: e.target.value } : p
                      )
                    )
                  }
                  className="w-20 text-center"
                  min={0}
                  step="any"
                />
                <Input
                  value={item.unit || ""}
                  onChange={(e) =>
                    setManualItems((prev) =>
                      prev.map((p, i) =>
                        i === index ? { ...p, unit: e.target.value || null } : p
                      )
                    )
                  }
                  placeholder="unit"
                  className="w-16 text-center text-xs"
                />
              </div>
            ))}
            {manualItems.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No products yet. Add your first one below.
              </p>
            )}
            {showAddProduct ? (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  placeholder="Product name"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="flex-1"
                />
                <Input
                  placeholder="Unit"
                  value={newProductUnit}
                  onChange={(e) => setNewProductUnit(e.target.value)}
                  className="w-20"
                />
                <Button
                  size="sm"
                  disabled={addProduct.isPending || !newProductName.trim()}
                  onClick={async () => {
                    try {
                      await addProduct.mutateAsync({
                        name: newProductName.trim(),
                        defaultUnit: newProductUnit.trim() || undefined,
                      });
                      setNewProductName("");
                      setNewProductUnit("");
                      setShowAddProduct(false);
                      // Reset manual items so they refresh with the new product
                      setManualItems([]);
                      toast.success("Product added");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to add");
                    }
                  }}
                >
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddProduct(false)}>
                  ✕
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAddProduct(true)}
              >
                + Add new product
              </Button>
            )}
            <Button
              className="w-full mt-2"
              onClick={handleManualConfirm}
              disabled={manualItems.length === 0}
            >
              Review & confirm
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
    </>
  );
}
