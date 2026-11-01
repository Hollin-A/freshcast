import preview from "#.storybook/preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "./auth-shell";

const meta = preview.meta({
  component: AuthShell,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "Welcome back.",
    subtitle: "Log in to see tomorrow's prep.",
    children: (
      <>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
        <Button className="mt-2">Log in</Button>
      </>
    ),
    footer: "New here? Create an account",
  },
});

export const Default = meta.story();

export const WithoutSubtitle = meta.story({ args: { subtitle: undefined, footer: undefined } });
