import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatClient } from "./chat-client";

export default async function ChatPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const business = await prisma.business.findUnique({
    where: { userId: session.user.id },
    select: { onboarded: true, name: true },
  });
  if (!business?.onboarded) redirect("/onboarding");

  return (
    <div className="mx-auto flex max-w-md flex-col pb-28" style={{ height: "calc(100vh - 5rem)" }}>
      <ChatClient businessName={business.name} />
    </div>
  );
}
