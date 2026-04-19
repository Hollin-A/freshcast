export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-cream">
      {/* Decorative gradient */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 10%, rgba(181,85,58,0.08), transparent 40%), radial-gradient(circle at 80% 90%, rgba(107,122,58,0.06), transparent 40%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col px-7">
        {children}
      </div>
    </div>
  );
}
