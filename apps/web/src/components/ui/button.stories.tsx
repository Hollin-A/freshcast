import { expect, fn } from "storybook/test";
import preview from "#.storybook/preview";
import { Button } from "./button";

const meta = preview.meta({
  component: Button,
  args: { children: "Save sales", onClick: fn() },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "outline", "secondary", "ghost", "destructive", "link", "dark"],
    },
    size: { control: "select", options: ["xs", "sm", "default", "lg"] },
  },
});

export const Default = meta.story({
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Save sales" }));
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
});

export const Variants = meta.story({
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <Button {...args}>Default</Button>
      <Button {...args} variant="outline">Outline</Button>
      <Button {...args} variant="secondary">Secondary</Button>
      <Button {...args} variant="ghost">Ghost</Button>
      <Button {...args} variant="destructive">Destructive</Button>
      <Button {...args} variant="link">Link</Button>
      <Button {...args} variant="inverse">Inverse</Button>
    </div>
  ),
});

export const Sizes = meta.story({
  render: (args) => (
    <div className="flex items-center gap-2">
      <Button {...args} size="xs">Extra small</Button>
      <Button {...args} size="sm">Small</Button>
      <Button {...args}>Default</Button>
      <Button {...args} size="lg">Large</Button>
    </div>
  ),
});

export const Disabled = meta.story({
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Save sales" })).toBeDisabled();
  },
});
