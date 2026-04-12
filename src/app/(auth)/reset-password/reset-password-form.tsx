"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!token || !email) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-lg font-medium mb-2">Invalid reset link</p>
          <p className="text-sm text-muted-foreground mb-4">
            This link is invalid or has expired.
          </p>
          <Link href="/forgot-password">
            <Button variant="outline">Request a new link</Button>
          </Link>
        </CardContent>
      </Card>
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

  if (success) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-lg font-medium mb-2">Password reset</p>
          <p className="text-sm text-muted-foreground mb-4">
            Your password has been updated. You can now log in.
          </p>
          <Link href="/login">
            <Button>Go to login</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Set new password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autoComplete="new-password"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Resetting..." : "Reset password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
