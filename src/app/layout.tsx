import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getMessages, getLocale } from "next-intl/server";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BizSense",
  description:
    "AI-powered sales tracking and demand prediction for small businesses",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BizSense",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2a9d8f",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers locale={locale} messages={messages as Record<string, unknown>}>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
