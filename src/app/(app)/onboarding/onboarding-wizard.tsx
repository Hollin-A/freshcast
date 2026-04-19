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
import { Badge } from "@/components/ui/badge";
import { BUSINESS_TYPES } from "@/lib/constants";

const TOTAL_STEPS = 3;

const BUSINESS_TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  BUTCHER: { label: "Butcher", icon: "🥩" },
  GROCERY: { label: "Grocer", icon: "🥬" },
  RETAIL_VENDOR: { label: "Bakery", icon: "🥖" },
  PRODUCE_SELLER: { label: "Produce", icon: "🍎" },
  CAFE: { label: "Café", icon: "☕" },
  MARKET_STALL: { label: "Market", icon: "🧺" },
  TAKEAWAY: { label: "Takeaway", icon: "🥡" },
  OTHER: { label: "Other", icon: "＋" },
};

function ProgressDots({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5 px-6">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i < step ? "bg-terra" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

function OnboardShell({
  step,
  title,
  subtitle,
  children,
  cta,
  onCta,
  onBack,
  disabled,
}: {
  step: number;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  cta: string;
  onCta: () => void;
  onBack?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        {onBack ? (
          <button onClick={onBack} className="text-[15px] text-body">← Back</button>
        ) : <div />}
        <span className="font-mono text-[13px] tracking-wide text-muted-warm">
          Step {step} of {TOTAL_STEPS}
        </span>
        <div className="w-10" />
      </div>
      <ProgressDots step={step} />
      <div className="px-6 pt-8">
        <h1 className="font-serif text-[28px] font-medium leading-[1.1] tracking-tight text-ink">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted-warm">{subtitle}</p>
        )}
      </div>
      <div className="flex-1 overflow-auto px-5 pt-6">{children}</div>
      <div className="border-t border-line bg-cream px-5 pt-4 pb-10">
        <Button size="lg" className="w-full" onClick={onCta} disabled={disabled}>
          {cta}
        </Button>
      </div>
    </div>
  );
}

function BusinessTypeTile({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[80px] flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors ${
        selected
          ? "border-ink bg-ink text-cream"
          : "border-line bg-paper text-ink"
      }`}
    >
      <span className="text-[22px]">{icon}</span>
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  );
}

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

  function handleStep1() {
    step1Form.handleSubmit((data) => {
      setBusinessInfo(data);
      setStep(2);
    })();
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

  function handleStep2() {
    const validProducts = products.filter((p) => p.name.trim() !== "");
    if (validProducts.length === 0) {
      toast.error("Please add at least one product");
      return;
    }
    setStep(3);
  }

  async function handleFinish() {
    const validProducts = products.filter((p) => p.name.trim() !== "");
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

  // Step 1: Business name + type
  if (step === 1) {
    return (
      <OnboardShell
        step={1}
        title={<>What&apos;s your<br />business called?</>}
        subtitle="This only appears on your home screen."
        cta="Continue"
        onCta={handleStep1}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Business name</Label>
            <Input
              id="name"
              placeholder="e.g., Ali's Fresh Market"
              {...step1Form.register("name")}
            />
            {step1Form.formState.errors.name && (
              <p className="text-sm text-terra">{step1Form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-2.5">What do you sell?</Label>
            <div className="grid grid-cols-3 gap-2">
              {BUSINESS_TYPES.map((type) => {
                const config = BUSINESS_TYPE_CONFIG[type] || { label: type, icon: "📦" };
                return (
                  <BusinessTypeTile
                    key={type}
                    label={config.label}
                    icon={config.icon}
                    selected={step1Form.watch("type") === type}
                    onClick={() => step1Form.setValue("type", type, { shouldValidate: true })}
                  />
                );
              })}
            </div>
            {step1Form.formState.errors.type && (
              <p className="mt-2 text-sm text-terra">{step1Form.formState.errors.type.message}</p>
            )}
          </div>
        </div>
      </OnboardShell>
    );
  }

  // Step 2: Products
  if (step === 2) {
    return (
      <OnboardShell
        step={2}
        title={<>Your starter<br />product list.</>}
        subtitle="Add your 3–5 bestsellers. You can add more anytime — Freshcast learns as you log sales."
        cta="Continue"
        onCta={handleStep2}
        onBack={() => setStep(1)}
      >
        <div className="flex flex-col gap-2">
          {products.map((product, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-xl border border-line bg-paper px-3.5 py-3"
            >
              <div className="flex-1">
                <Input
                  placeholder={`Product ${index + 1}`}
                  value={product.name}
                  onChange={(e) => updateProduct(index, "name", e.target.value)}
                  className="border-0 bg-transparent p-0 text-[15px] font-medium shadow-none focus-visible:ring-0"
                />
              </div>
              <Badge variant="secondary">
                <input
                  placeholder="unit"
                  value={product.defaultUnit}
                  onChange={(e) => updateProduct(index, "defaultUnit", e.target.value)}
                  className="w-14 bg-transparent text-center text-[11px] outline-none placeholder:text-mute2"
                />
              </Badge>
              {products.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeProductRow(index)}
                  className="text-lg text-mute2 hover:text-ink"
                  aria-label={`Remove product ${index + 1}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {products.length < 10 && (
            <button
              type="button"
              onClick={addProductRow}
              className="flex items-center gap-2.5 rounded-xl border border-dashed border-line px-3.5 py-3 text-sm text-muted-warm"
            >
              <span className="text-lg text-terra">＋</span> Add a product
            </button>
          )}
        </div>
      </OnboardShell>
    );
  }

  // Step 3: You're set
  return (
    <OnboardShell
      step={3}
      title={<>You&apos;re set.</>}
      subtitle="Log your sales each day after closing. After about a week, Freshcast will start showing you forecasts."
      cta="Log my first sale"
      onCta={handleFinish}
      onBack={() => setStep(2)}
      disabled={isSubmitting}
    >
      <div className="rounded-2xl border border-line bg-paper p-5">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-warm">
          What happens next
        </p>
        {[
          ["1", "Log each day after closing", "Takes under 30 seconds. Speak it or type."],
          ["2", "Watch the pattern form", "Forecasts start appearing after 5–7 days of logs."],
          ["3", "Wake up to tomorrow's forecast", "Quantities, not guesses. Prep with confidence."],
        ].map(([n, title, desc], i) => (
          <div
            key={n}
            className={`flex gap-3 py-2.5 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-terra font-serif text-sm font-semibold text-[#FFF8EC]">
              {n}
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-warm">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </OnboardShell>
  );
}
