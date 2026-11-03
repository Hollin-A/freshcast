import type { Metadata, Viewport } from "next";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import { THEME_COLOR } from "@/components/shared/theme-color";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Freshcast",
  description:
    "AI-powered sales tracking and demand prediction for small businesses",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Freshcast",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: THEME_COLOR,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {children}
          <Toaster
            position="top-center"
            richColors
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
              },
            }}
          />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
