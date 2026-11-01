import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";

// Shared by the root layout and Storybook's preview, so stories render in the
// App's typefaces.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-serif",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const fontVariables = `${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`;
