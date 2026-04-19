"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell } from "@/components/shared/auth-shell";

const schema = z.object({
  password: z.string().min(8, { error: "Password must be at least 8 characters" }),
  confirmPassword: z.string().min(1, { error: "Please confirm your password" }),
}).check(
  (ctx) => {
    if (ctx.value.password !== ctx.value.confirmPassword) {
      ctx.issues.push({ code: "custom", input: ctx.value.confirmPassword, message: "Passwords don't match", path: ["confirmPassword"] });
    }
  }
);

type FormValues = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const email = searchParams.get("email");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token || !email) {
    return (
      <AuthShell
        title="Invalid reset link"
        subtitle="This link is invalid or has expired."
        footer={
          <Link href="/forgot-password" className="font-semibold text-terra">Request a new link</Link>
        }
      >
        <div />
      </AuthShell>
    );
  }

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password: data.password }),
      });

      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error?.message || "Something went wrong");
        return;
      }

      setSuccess(true);
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (success) {
    return (
      <AuthShell
        title="Password reset"
        subtitle="Your password has been updated. You can now log in."
        footer={
          <Link href="/login" className="font-semibold text-terra">Go to log in</Link>
        }
      >
        <div />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Set new password"
      subtitle="Enter your new password below."
      footer={
        <Link href="/login" className="font-semibold text-terra">← Back to log in</Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <PasswordInput
            id="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm text-terra">{errors.password.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder="Repeat your password"
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-terra">{errors.confirmPassword.message}</p>
          )}
        </div>
        <div className="mt-2">
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Resetting..." : "Reset password"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
