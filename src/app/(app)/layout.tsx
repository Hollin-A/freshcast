import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Check if user has completed onboarding
  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { onboarded: true },
  });

  // If no business or not onboarded, redirect to onboarding
  // (but not if already on the onboarding page)
  if (!business?.onboarded) {
    // We'll handle this redirect in individual pages for now
    // to avoid redirect loops with the onboarding page itself
  }

  return <>{children}</>;
}
