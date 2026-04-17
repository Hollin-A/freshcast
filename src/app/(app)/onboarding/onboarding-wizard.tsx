"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BUSINESS_TYPES } from "@/lib/constants";

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  RETAIL_VENDOR: "Retail Vendor",
  BUTCHER: "Butcher",
  PRODUCE_SELLER: "Produce Seller",
  MARKET_STALL: "Market Stall",
  GROCERY: "Grocery Store",
  CAFE: "Café",
  TAKEAWAY: "Takeaway",
  OTHER: "Other",
};

const step1Schema = z.object({
  name: z.string().min(1, { error: "Business name is required" }).max(100),
  type: z.enum(BUSINESS_TYPES, { error: "Please select a business type" }),
});

type Step1Values = z.infer<typeof step1Schema>;

type ProductEntry = { name: string; defaultUnit: string };

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [businessInfo, setBusinessInfo] = useState<Step1Values | null>(null);
  const [products, setProducts] = useState<ProductEntry[]>([
    { name: "", defaultUnit: "" },
    { name: "", defaultUnit: "" },
    { name: "", defaultUnit: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
  });

  function handleStep1(data: Step1Values) {
    setBusinessInfo(data);
    setStep(2);
  }

  function updateProduct(index: number, field: keyof ProductEntry, value: string) {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  function addProductRow() {
    if (products.length >= 10) return;
    setProducts((prev) => [...prev, { name: "", defaultUnit: "" }]);
  }

  function removeProductRow(index: number) {
    if (products.length <= 1) return;
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleFinish() {
    const validProducts = products.filter((p) => p.name.trim() !== "");
    if (validProducts.length === 0) {
      toast.error("Please add at least one product");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...businessInfo,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          products: validProducts.map((p) => ({
            name: p.name.trim(),
            defaultUnit: p.defaultUnit.trim() || undefined,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error?.message || "Something went wrong");
        return;
      }

      toast.success("You're all set!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === 1) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Freshcast</CardTitle>
          <CardDescription>
            Tell us about your business to get started
          </CardDescription>
        </CardHeader>
        <form onSubmit={step1Form.handleSubmit(handleStep1)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Business name</Label>
              <Input
                id="name"
                placeholder="e.g., Ali's Butcher Shop"
                {...step1Form.register("name")}
              />
              {step1Form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {step1Form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Business type</Label>
              <Select
                onValueChange={(val) =>
                  step1Form.setValue("type", val as Step1Values["type"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select your business type" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {BUSINESS_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {step1Form.formState.errors.type && (
                <p className="text-sm text-destructive">
                  {step1Form.formState.errors.type.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Next
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Add your products</CardTitle>
        <CardDescription>
          List 3–5 products you sell most often. You can always add more later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {products.map((product, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="flex-1">
              <Input
                placeholder={`Product ${index + 1}`}
                value={product.name}
                onChange={(e) => updateProduct(index, "name", e.target.value)}
              />
            </div>
            <div className="w-24">
              <Input
                placeholder="Unit"
                value={product.defaultUnit}
                onChange={(e) =>
                  updateProduct(index, "defaultUnit", e.target.value)
                }
              />
            </div>
            {products.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeProductRow(index)}
                aria-label={`Remove product ${index + 1}`}
              >
                ✕
              </Button>
            )}
          </div>
        ))}
        {products.length < 10 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={addProductRow}
          >
            + Add another product
          </Button>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
          Back
        </Button>
        <Button
          onClick={handleFinish}
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? "Setting up..." : "Get started"}
        </Button>
      </CardFooter>
    </Card>
  );
}
