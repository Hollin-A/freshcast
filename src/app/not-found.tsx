import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-semibold text-primary mb-4">404</p>
        <p className="text-lg font-medium mb-2">{t("notFound")}</p>
        <p className="text-sm text-muted-foreground mb-6">{t("notFoundDesc")}</p>
        <Link href="/dashboard">
          <Button>{t("goToDashboard")}</Button>
        </Link>
      </div>
    </div>
  );
}
