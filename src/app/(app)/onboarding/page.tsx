import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // If already onboarded, go to dashboard
  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { onboarded: true },
  });

  if (business?.onboarded) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Welcome to BizSense</h1>
      <p className="text-muted-foreground">
        Onboarding will be built in Phase 2.
      </p>
    </div>
  );
}
