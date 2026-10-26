import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BigNumber } from "../big-number";

describe("BigNumber", () => {
  it("renders the value with its unit", () => {
    render(<BigNumber value={42} unit="kg" />);

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("kg")).toBeInTheDocument();
  });

  it("omits the unit and trend when not given", () => {
    const { container } = render(<BigNumber value="1,200" />);

    expect(screen.getByText("1,200")).toBeInTheDocument();
    expect(container.querySelectorAll("span")).toHaveLength(1);
  });

  // Trend colour carries meaning (up vs down), so it is the one place these
  // tests look at class names. Update them alongside the Brand tokens.
  it("colours a rising trend as positive", () => {
    render(<BigNumber value={10} trend="+12%" />);

    expect(screen.getByText("+12%")).toHaveClass("text-olive");
  });

  it("colours a falling trend as negative", () => {
    render(<BigNumber value={10} trend="-8%" />);

    expect(screen.getByText("-8%")).toHaveClass("text-terra");
  });
});
