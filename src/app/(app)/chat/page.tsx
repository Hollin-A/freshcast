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
    <div className="mx-auto max-w-md px-4 py-6 flex flex-col" style={{ height: "calc(100vh - 5rem)" }}>
      <h1 className="text-xl font-semibold mb-4">Ask Freshcast</h1>
      <ChatClient businessName={business.name} />
    </div>
  );
}
