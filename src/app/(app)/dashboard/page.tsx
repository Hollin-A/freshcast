import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { name: true, onboarded: true },
  });

  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {session.user.name || "there"}
          </p>
        </div>
        <LogoutButton />
      </div>
      <DashboardClient />
      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
        Your data is private. BizSense works only for your business.
      </p>
    </div>
  );
}
