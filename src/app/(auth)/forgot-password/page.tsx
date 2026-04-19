"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/shared/auth-shell";

const schema = z.object({
  email: z.email({ error: "Please enter a valid email" }),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setSent(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle="If an account exists with that email, we've sent a password reset link."
        footer={
          <Link href="/login" className="font-semibold text-terra">← Back to log in</Link>
        }
      >
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter the email you signed up with and we'll send a reset link."
      footer={
        <Link href="/login" className="font-semibold text-terra">← Back to log in</Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-terra">{errors.email.message}</p>
          )}
        </div>
        <div className="mt-2">
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
