import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "./logout-button";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { name: true, onboarded: true },
  });

  if (!business?.onboarded) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Welcome, {session.user.name || session.user.email}
      </p>
      {business && (
        <p className="text-sm text-muted-foreground">{business.name}</p>
      )}
      <LogoutButton />
    </div>
  );
}
