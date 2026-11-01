import { expect } from "storybook/test";
import preview from "#.storybook/preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = preview.meta({
  component: TabsList,
  render: (args) => (
    <Tabs defaultValue="type" className="w-80">
      <TabsList {...args}>
        <TabsTrigger value="type">Type</TabsTrigger>
        <TabsTrigger value="receipt">Receipt</TabsTrigger>
      </TabsList>
      <TabsContent value="type">Type what you sold today.</TabsContent>
      <TabsContent value="receipt">Upload a photo of a receipt.</TabsContent>
    </Tabs>
  ),
});

export const Default = meta.story({
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Type what you sold today.")).toBeVisible();

    await userEvent.click(canvas.getByRole("tab", { name: "Receipt" }));
    await expect(canvas.getByRole("tab", { name: "Receipt" })).toHaveAttribute("aria-selected", "true");
    await expect(await canvas.findByText("Upload a photo of a receipt.")).toBeVisible();
  },
});

export const Line = meta.story({ args: { variant: "line" } });
