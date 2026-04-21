"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const prevProductVersionRef = useRef("");
  const currentProductVersion = products.map((p) => p.id).join(",");

  // Reset manual items when product list changes (detected in initManualItems)
  function initManualItems() {
    prevProductVersionRef.current = currentProductVersion;
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

    const validItems = parsedItems.filter((p) => p.quantity > 0);
    if (validItems.length === 0) {
      toast.error("All items have zero quantity. Please enter valid quantities.");
      return;
    }

    const unresolvedAmbiguous = parsedItems.filter(
      (p) => p.status === "ambiguous" && (!p.quantity || p.quantity <= 0)
    );
    if (unresolvedAmbiguous.length > 0) {
      toast.error("Please enter quantities for all highlighted items.");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        date: selectedDate,
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

  const dateLabel = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Confirmation / Review screen
  if (showConfirm && parsedItems) {
    return (
      <>
        <div className="flex items-center justify-between px-5 pt-14 pb-2">
          <button onClick={() => { setShowConfirm(false); setParsedItems(null); }} className="text-[15px] text-body">← Edit</button>
          <span className="text-[15px] text-muted-warm">{dateLabel}</span>
        </div>
        <div className="px-5 pt-2 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">Confirm your log</p>
          <h1 className="mt-1 font-serif text-[26px] font-medium tracking-tight text-ink">Looks good?</h1>
        </div>

        {inputMethod === "NATURAL_LANGUAGE" && nlText && (
          <div className="mx-4 mb-4 rounded-xl border border-line bg-paper p-3.5">
            <p className="font-serif text-[15px] italic leading-relaxed text-body">
              &ldquo;{nlText}&rdquo;
            </p>
          </div>
        )}

        <div className="mx-4 mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">Parsed items</p>
          <span className="text-[13px] font-semibold text-terra">{parsedItems.length} items</span>
        </div>

        <div className="mx-4 flex flex-col gap-2">
          {parsedItems.map((item, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 rounded-xl border p-3 ${
                item.status === "ambiguous"
                  ? "border-harvest/50 bg-harvest/8"
                  : "border-line bg-paper"
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold ${
                !item.matched
                  ? "bg-harvest/18 text-[#8A6520]"
                  : "bg-shell text-body"
              }`}>
                {!item.matched ? "+" : "✓"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium text-ink">{item.product}</p>
                {!item.matched && (
                  <p className="text-[11px] text-[#8A6520]">New product — tap to confirm</p>
                )}
                {item.clarification && (
                  <p className="text-[11px] text-harvest">{item.clarification}</p>
                )}
              </div>
              <Input
                type="number"
                value={item.quantity || ""}
                onChange={(e) => updateParsedQuantity(index, parseFloat(e.target.value) || 0)}
                className={`w-20 text-center font-serif text-lg font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                  item.status === "ambiguous" ? "border-harvest" : ""
                }`}
                min={0}
                step="any"
                autoFocus={item.status === "ambiguous"}
                placeholder={item.status === "ambiguous" ? "?" : "0"}
              />
              <span className="min-w-[40px] text-xs text-muted-warm">{item.unit || ""}</span>
              {!item.matched ? (
                <button onClick={() => handleAddUnmatched(item)} className="text-xs font-semibold text-terra">Add</button>
              ) : (
                <button onClick={() => removeParsedItem(index)} className="text-lg text-mute2">×</button>
              )}
            </div>
          ))}
        </div>

        <div className="mx-4 mt-4 rounded-xl border border-olive/20 bg-olive/8 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-olive-dk">Once saved</p>
          <p className="mt-1 font-serif text-base font-medium tracking-tight text-ink">
            Tomorrow&apos;s forecast will refresh with your latest data.
          </p>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-cream px-4 pb-24 pt-4">
          <div className="mx-auto max-w-md">
            <Button
              size="lg"
              className="w-full"
              onClick={handleSave}
              disabled={
                saveMutation.isPending ||
                parsedItems.length === 0 ||
                parsedItems.some((p) => !p.productId)
              }
            >
              {saveMutation.isPending ? "Saving..." : "Save sales log"}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Main input screen
  return (
    <>
      <div className="px-5 pt-14 pb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
          Log sales · {dateLabel}
        </p>
        <h1 className="mt-1 font-serif text-[26px] font-medium tracking-tight text-ink">
          Tell me your day.
        </h1>
      </div>

      <div className="px-4 pb-3">
        <Label className="mb-1.5 block text-muted-warm">Date</Label>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={new Date().toLocaleDateString("en-CA")}
          className="w-full"
        />
      </div>

      <Tabs
        defaultValue="nl"
        className="px-4"
        onValueChange={(v) => {
          if (v === "manual") initManualItems();
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="nl" className="flex-1">Speak or type</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">By product</TabsTrigger>
        </TabsList>

        <TabsContent value="nl">
          <div className="mt-4">
            <div className="rounded-2xl border border-terra bg-paper p-4 shadow-[0_0_0_4px_rgba(181,85,58,0.10)]">
              <textarea
                className="w-full min-h-[120px] resize-none bg-transparent font-serif text-lg leading-relaxed text-ink placeholder:text-mute2 focus:outline-none"
                placeholder='e.g., "sold 20 eggs, 30kg beef, and 10 milk bottles"'
                value={nlText}
                onChange={(e) => setNlText(e.target.value)}
              />
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary">for {dateLabel.split(",")[0]}</Badge>
                <span className="flex-1" />
                <span className="font-mono text-[11px] text-mute2">{nlText.length} chars</span>
              </div>
            </div>
            <div className="mt-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleParse}
                disabled={parseMutation.isPending || !nlText.trim()}
              >
                {parseMutation.isPending ? "Parsing..." : "Review & save →"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual">
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">
                Your products · {manualItems.length}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {manualItems.map((item, index) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">{item.productName}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-warm">
                      {item.unit || "units"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-shell text-lg text-body"
                      onClick={() =>
                        setManualItems((prev) =>
                          prev.map((p, i) =>
                            i === index
                              ? { ...p, quantity: String(Math.max(0, (parseFloat(p.quantity) || 0) - 1)) }
                              : p
                          )
                        )
                      }
                    >
                      −
                    </button>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        setManualItems((prev) =>
                          prev.map((p, i) =>
                            i === index ? { ...p, quantity: e.target.value } : p
                          )
                        )
                      }
                      className={`w-14 text-center font-serif text-lg font-medium ${
                        item.quantity ? "border-ink bg-ink text-cream" : "bg-shell text-mute2"
                      }`}
                      min={0}
                      step="any"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-terra text-lg text-[#FFF8EC]"
                      onClick={() =>
                        setManualItems((prev) =>
                          prev.map((p, i) =>
                            i === index
                              ? { ...p, quantity: String((parseFloat(p.quantity) || 0) + 1) }
                              : p
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {showAddProduct ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3">
                  <Input
                    placeholder="Product name"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="flex-1 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                  />
                  <Input
                    placeholder="unit"
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    className="w-16 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
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
                        setManualItems([]);
                        toast.success("Product added");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to add");
                      }
                    }}
                  >
                    Add
                  </Button>
                  <button onClick={() => setShowAddProduct(false)} className="text-lg text-mute2">×</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-muted-warm"
                >
                  <span className="text-lg text-terra">＋</span> Add a new product
                </button>
              )}
            </div>

            {manualItems.some((m) => parseFloat(m.quantity) > 0) && (
              <div className="mt-4 rounded-xl border border-line bg-paper p-3.5 flex items-center gap-2.5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-warm">Running total</p>
                  <p className="font-serif text-[22px] font-medium tracking-tight text-ink">
                    {Math.round(manualItems.reduce((s, m) => s + (parseFloat(m.quantity) || 0), 0))} units · {manualItems.filter((m) => parseFloat(m.quantity) > 0).length} products
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <Button
                size="lg"
                className="w-full"
                onClick={handleManualConfirm}
                disabled={manualItems.length === 0}
              >
                Review & save
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
