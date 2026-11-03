import preview from "#.storybook/preview";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./card";

const meta = preview.meta({
  component: Card,
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <CardTitle>Lamb chops</CardTitle>
        <CardDescription>Sold by the portion</CardDescription>
        <CardAction>
          <Badge variant="success">Active</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>Averaging 18 portions a day over the last week.</CardContent>
      <CardFooter>
        <Button size="sm">Edit product</Button>
      </CardFooter>
    </Card>
  ),
});

export const Default = meta.story();

export const Small = meta.story({ args: { size: "sm" } });
