import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MobileNav } from "@/components/shared/mobile-nav";
import { ChatBubble } from "@/components/shared/chat-bubble";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { name: true, onboarded: true },
  });

  return (
    <>
      <main className="pb-20 overflow-x-hidden">{children}</main>
      <MobileNav />
      {business?.onboarded && (
        <ChatBubble businessName={business.name} />
      )}
    </>
  );
}
