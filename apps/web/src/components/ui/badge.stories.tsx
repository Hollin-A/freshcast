import preview from "#.storybook/preview";
import { Badge } from "./badge";

const meta = preview.meta({
  component: Badge,
  args: { children: "Private" },
});

export const Default = meta.story();

export const Variants = meta.story({
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      <Badge {...args}>Default</Badge>
      <Badge {...args} variant="secondary">Secondary</Badge>
      <Badge {...args} variant="destructive">Destructive</Badge>
      <Badge {...args} variant="outline">Outline</Badge>
      <Badge {...args} variant="ghost">Ghost</Badge>
      <Badge {...args} variant="link">Link</Badge>
      <Badge {...args} variant="success">Success</Badge>
      <Badge {...args} variant="warning">Warning</Badge>
      <Badge {...args} variant="inverse">Inverse</Badge>
    </div>
  ),
});
