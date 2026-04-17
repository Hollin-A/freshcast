import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [business, user] = await Promise.all([
    prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { name: true, type: true, timezone: true, onboarded: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    }),
  ]);
  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <SettingsClient
        userName={session.user.name || ""}
        userEmail={session.user.email || ""}
        emailVerified={!!user?.emailVerified}
        businessName={business.name}
        businessType={business.type}
        timezone={business.timezone}
      />
    </div>
  );
}
