import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SalesInputClient } from "./sales-input-client";

export default async function SalesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { onboarded: true },
  });
  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-md px-4 py-8 overflow-hidden">
      <SalesInputClient />
    </div>
  );
}
