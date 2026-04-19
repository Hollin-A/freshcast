import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { name: true, onboarded: true },
  });

  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-md pb-28">
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-warm">
            Good evening, {session.user.name || "there"}
          </p>
          <h1 className="mt-0.5 font-serif text-[26px] font-medium tracking-tight text-ink">
            {business.name}
          </h1>
        </div>
        <a
          href="/settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-paper font-serif text-base font-semibold text-ink"
        >
          {(session.user.name?.[0] || "U").toUpperCase()}
        </a>
      </div>
      <DashboardClient />
    </div>
  );
}
