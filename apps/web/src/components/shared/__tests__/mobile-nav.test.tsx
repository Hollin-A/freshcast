import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MobileNav } from "../mobile-nav";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

function renderAt(pathname: string) {
  navigation.pathname = pathname;
  renderWithProviders(<MobileNav />);
}

describe("MobileNav", () => {
  it("links to every App section with translated labels", () => {
    renderAt("/dashboard");

    const links = screen.getAllByRole("link");
    expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Today", "/dashboard"],
      ["Log", "/sales"],
      ["History", "/sales/history"],
      ["Products", "/products"],
      ["Settings", "/settings"],
    ]);
  });

  it.each([
    ["/dashboard", "Today"],
    ["/sales", "Log"],
    ["/sales/history", "History"],
    ["/products/abc123", "Products"],
    ["/settings/business", "Settings"],
  ])("marks only the matching tab as current on %s", (pathname, label) => {
    renderAt(pathname);

    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });
});
