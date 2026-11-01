import { expect, screen, waitFor } from "storybook/test";
import preview from "#.storybook/preview";
import { Button } from "./button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

const meta = preview.meta({
  component: SheetContent,
  args: { side: "bottom" },
  render: (args) => (
    <Sheet>
      <SheetTrigger render={<Button />}>Edit product</SheetTrigger>
      <SheetContent {...args}>
        <SheetHeader>
          <SheetTitle>Edit product</SheetTitle>
          <SheetDescription>Change the name or default unit.</SheetDescription>
        </SheetHeader>
        <SheetFooter>
          <Button>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
});

export const Bottom = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Edit product" }));
    // The sheet is portalled into <body>, outside the story canvas.
    const dialog = await screen.findByRole("dialog", { name: "Edit product" });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  },
});

export const Right = meta.story({ args: { side: "right" } });
