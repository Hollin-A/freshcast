import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { onboarded: true },
  });

  if (business?.onboarded) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <OnboardingWizard />
      </div>
    </div>
  );
}
