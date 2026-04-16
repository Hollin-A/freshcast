import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { MobileNav } from "@/components/shared/mobile-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <>
      <main className="pb-20 overflow-x-hidden">{children}</main>
      <MobileNav />
    </>
  );
}
