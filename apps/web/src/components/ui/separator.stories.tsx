import preview from "#.storybook/preview";
import { Separator } from "./separator";

const meta = preview.meta({
  component: Separator,
});

export const Horizontal = meta.story({
  render: (args) => (
    <div className="w-72 text-sm">
      <p>Today</p>
      <Separator {...args} className="my-3" />
      <p>Yesterday</p>
    </div>
  ),
});

export const Vertical = meta.story({
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-6 items-center gap-3 text-sm">
      <span>Sales</span>
      <Separator {...args} />
      <span>Products</span>
    </div>
  ),
});
