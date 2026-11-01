import { useState, type ReactNode } from "react";
import { definePreview } from "@storybook/nextjs-vite";
import addonA11y from "@storybook/addon-a11y";
import addonThemes, { withThemeByClassName } from "@storybook/addon-themes";
import addonMsw from "msw-storybook-addon";
import { SessionProvider } from "next-auth/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fontVariables } from "@/app/fonts";
import messages from "@/messages/en.json";
import { createHandlers } from "@/test/msw/handlers";
import { session } from "@/test/msw/fixtures/session";
import "@/app/globals.css";

// Mirrors components/providers.tsx. SessionProvider starts from the fixture
// session, and the MSW handlers answer its refetches.
function StoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      }),
  );
  return (
    <SessionProvider session={session}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}

// Portalled content (Sheet, Select) renders into <body>, so the font
// variables go on <html> as in the root layout.
document.documentElement.classList.add(...fontVariables.split(" "), "antialiased");

export default definePreview({
  addons: [addonA11y(), addonThemes(), addonMsw()],

  parameters: {
    nextjs: { appDirectory: true },
    // Report accessibility violations without failing the run until the new
    // Brand lands (#98). The current palette fails contrast in dark mode,
    // because only the shadcn tokens have dark values (#96).
    a11y: { test: "todo" },
  },

  // Every story gets the Legacy API mocks; a story can override endpoints in
  // its own beforeEach with msw.use(...).
  beforeEach({ msw }) {
    msw.use(...createHandlers());
  },

  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
    }),
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
});
