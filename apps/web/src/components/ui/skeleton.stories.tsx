import preview from "#.storybook/preview";
import { Skeleton } from "./skeleton";

const meta = preview.meta({
  component: Skeleton,
});

export const Default = meta.story({
  render: (args) => (
    <div className="flex w-72 flex-col gap-2">
      <Skeleton {...args} className="h-6 w-1/2" />
      <Skeleton {...args} className="h-24 w-full" />
    </div>
  ),
});
