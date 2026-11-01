import preview from "#.storybook/preview";
import { Input } from "./input";
import { Label } from "./label";

const meta = preview.meta({
  component: Label,
  args: { children: "Email" },
});

export const Default = meta.story();

export const WithInput = meta.story({
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <Label {...args} htmlFor="email" />
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
});
