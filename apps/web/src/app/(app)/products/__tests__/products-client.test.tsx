import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { Toaster } from "sonner";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ok } from "@/test/msw/envelope";
import { server } from "@/test/msw/server";
import { ProductsClient } from "../products-client";

function renderProducts() {
  return renderWithProviders(
    <>
      <ProductsClient />
      <Toaster />
    </>,
  );
}

describe("ProductsClient", () => {
  it("lists the business's active products with their daily average", async () => {
    renderProducts();

    expect(await screen.findByText("Lamb chops")).toBeInTheDocument();
    expect(screen.getByText("Catalog · 4 products")).toBeInTheDocument();
    expect(screen.getByText(/avg 11.4 kg\/day/)).toBeInTheDocument();
  });

  it("shows the empty state when the catalog has no products", async () => {
    server.use(http.get("/api/products", () => ok([])));
    renderProducts();

    expect(
      await screen.findByText("No products yet. Add your first one above."),
    ).toBeInTheDocument();
  });

  it("shows the API's message when the product already exists", async () => {
    const user = userEvent.setup();
    renderProducts();
    await screen.findByText("Lamb chops");

    await user.type(screen.getByPlaceholderText("Add product or search…"), "lamb chops");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(
      await screen.findByText("Product with this name already exists"),
    ).toBeInTheDocument();
  });
});
