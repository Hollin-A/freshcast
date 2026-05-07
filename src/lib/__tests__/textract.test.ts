import { describe, it, expect } from "vitest";
import { mapAnalyzeExpenseResponse } from "../textract";

function field(typeText: string, valueText: string) {
  return {
    Type: { Text: typeText },
    ValueDetection: { Text: valueText },
  };
}

function lineItem(...fields: ReturnType<typeof field>[]) {
  return { LineItemExpenseFields: fields };
}

describe("mapAnalyzeExpenseResponse", () => {
  it("maps a single line item with description, quantity, and prices", () => {
    const response = {
      ExpenseDocuments: [
        {
          LineItemGroups: [
            {
              LineItems: [
                lineItem(
                  field("ITEM", "FREE RANGE EGGS 12PK"),
                  field("QUANTITY", "1"),
                  field("UNIT_PRICE", "$9.50"),
                  field("PRICE", "$9.50"),
                  field("EXPENSE_ROW", "FREE RANGE EGGS 12PK    $9.50")
                ),
              ],
            },
          ],
        },
      ],
    };
    const lineItems = mapAnalyzeExpenseResponse(response);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0]).toMatchObject({
      description: "FREE RANGE EGGS 12PK",
      quantity: 1,
      unitPrice: 9.5,
      total: 9.5,
      rawRow: "FREE RANGE EGGS 12PK    $9.50",
    });
  });

  it("flattens line items across multiple ExpenseDocuments and groups", () => {
    const response = {
      ExpenseDocuments: [
        {
          LineItemGroups: [
            { LineItems: [lineItem(field("ITEM", "MILK 2L"), field("QUANTITY", "2"))] },
            { LineItems: [lineItem(field("ITEM", "BREAD"), field("QUANTITY", "3"))] },
          ],
        },
        {
          LineItemGroups: [
            { LineItems: [lineItem(field("ITEM", "EGGS"), field("QUANTITY", "12"))] },
          ],
        },
      ],
    };
    const lineItems = mapAnalyzeExpenseResponse(response);
    expect(lineItems).toHaveLength(3);
    expect(lineItems.map((i) => i.description)).toEqual(["MILK 2L", "BREAD", "EGGS"]);
    expect(lineItems.map((i) => i.quantity)).toEqual([2, 3, 12]);
  });

  it("strips currency symbols and commas when parsing numerics", () => {
    const response = {
      ExpenseDocuments: [
        {
          LineItemGroups: [
            {
              LineItems: [
                lineItem(field("ITEM", "PREMIUM BEEF"), field("PRICE", "$1,250.99")),
              ],
            },
          ],
        },
      ],
    };
    const [item] = mapAnalyzeExpenseResponse(response);
    expect(item.total).toBe(1250.99);
  });

  it("skips line items with no ITEM (description) field", () => {
    const response = {
      ExpenseDocuments: [
        {
          LineItemGroups: [
            {
              LineItems: [
                lineItem(field("QUANTITY", "1"), field("PRICE", "$5.00")),
                lineItem(field("ITEM", "VALID")),
              ],
            },
          ],
        },
      ],
    };
    const lineItems = mapAnalyzeExpenseResponse(response);
    expect(lineItems).toHaveLength(1);
    expect(lineItems[0].description).toBe("VALID");
  });

  it("returns null quantity when no QUANTITY field is present", () => {
    const response = {
      ExpenseDocuments: [
        {
          LineItemGroups: [
            {
              LineItems: [lineItem(field("ITEM", "BREAD"))],
            },
          ],
        },
      ],
    };
    const [item] = mapAnalyzeExpenseResponse(response);
    expect(item.quantity).toBeNull();
  });

  it("returns an empty array when the response has no expense documents", () => {
    expect(mapAnalyzeExpenseResponse({})).toEqual([]);
    expect(mapAnalyzeExpenseResponse({ ExpenseDocuments: [] })).toEqual([]);
    expect(
      mapAnalyzeExpenseResponse({ ExpenseDocuments: [{ LineItemGroups: [] }] })
    ).toEqual([]);
  });
});
