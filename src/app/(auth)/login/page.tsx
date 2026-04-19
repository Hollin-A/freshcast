"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { AuthShell } from "@/components/shared/auth-shell";

const loginSchema = z.object({
  email: z.email({ error: "Please enter a valid email" }),
  password: z.string().min(1, { error: "Password is required" }),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth");
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginValues) {
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error(t("invalidCredentials"));
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error(t("invalidCredentials"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthShell
      title={<>Welcome<br />back.</>}
      subtitle={t("loginDesc")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-semibold text-terra">{t("signup")}</Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" placeholder={t("emailPlaceholder")} autoComplete="email" {...register("email")} />
          {errors.email && <p className="text-sm text-terra">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput id="password" placeholder={t("passwordPlaceholder")} autoComplete="current-password" {...register("password")} />
          {errors.password && <p className="text-sm text-terra">{errors.password.message}</p>}
        </div>
        <div className="mt-2">
          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? t("loggingIn") : t("login")}
          </Button>
        </div>
        <div className="mt-2 text-center">
          <Link href="/forgot-password" className="text-sm text-body underline underline-offset-[3px]">
            {t("forgotPassword")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
