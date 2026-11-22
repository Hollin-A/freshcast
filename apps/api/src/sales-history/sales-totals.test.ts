import { describe, expect, it } from "vitest";
import { BusinessDate } from "../calendar/business-date.js";
import { type SalesEntryRow, totalSales } from "./sales-totals.js";

const d = BusinessDate.parse;
const WEEK = { from: d("2026-11-16"), to: d("2026-11-22") };

const tomatoes = { name: "Tomatoes", defaultUnit: "kg" };

describe("totalSales", () => {
  it("zero-fills every day of a window with no Sales entries", () => {
    expect(totalSales(WEEK, [])).toEqual({
      byProduct: [],
      byDay: [
        { date: "2026-11-16", quantity: 0 },
        { date: "2026-11-17", quantity: 0 },
        { date: "2026-11-18", quantity: 0 },
        { date: "2026-11-19", quantity: 0 },
        { date: "2026-11-20", quantity: 0 },
        { date: "2026-11-21", quantity: 0 },
        { date: "2026-11-22", quantity: 0 },
      ],
      byProductByDay: [],
    });
  });

  it("adds up a Product sold on only one day, across that day's Sales entries", () => {
    const entries: SalesEntryRow[] = [
      { date: d("2026-11-18"), items: [{ productId: "p1", quantity: 2.5, unit: "kg", product: tomatoes }] },
      { date: d("2026-11-18"), items: [{ productId: "p1", quantity: 1.25, unit: "kg", product: tomatoes }] },
    ];

    const totals = totalSales(WEEK, entries);

    expect(totals.byProduct).toEqual([{ productId: "p1", name: "Tomatoes", unit: "kg", quantity: 3.75 }]);
    expect(totals.byDay.map((day) => day.quantity)).toEqual([0, 0, 3.75, 0, 0, 0, 0]);
    expect(totals.byProductByDay).toEqual([
      { productId: "p1", name: "Tomatoes", unit: "kg", daily: [0, 0, 3.75, 0, 0, 0, 0] },
    ]);
  });

  // Kept from the Legacy API (ADR-023 §2); a slice may change it later.
  it("keeps the first unit seen and adds quantities in different units together", () => {
    const entries: SalesEntryRow[] = [
      { date: d("2026-11-16"), items: [{ productId: "p1", quantity: 2, unit: null, product: tomatoes }] },
      { date: d("2026-11-17"), items: [{ productId: "p1", quantity: 3, unit: "box", product: tomatoes }] },
    ];

    const [total] = totalSales(WEEK, entries).byProduct;

    expect(total).toEqual({ productId: "p1", name: "Tomatoes", unit: "kg", quantity: 5 });
  });

  it("has no unit when neither the Sales item nor the Product has one", () => {
    const entries: SalesEntryRow[] = [
      { date: d("2026-11-16"), items: [{ productId: "p2", quantity: 4, unit: null, product: { name: "Bread", defaultUnit: null } }] },
    ];

    expect(totalSales(WEEK, entries).byProduct[0]?.unit).toBeNull();
  });

  it("totals each Product separately and each day across Products", () => {
    const bread = { name: "Bread", defaultUnit: "loaf" };
    const entries: SalesEntryRow[] = [
      {
        date: d("2026-11-16"),
        items: [
          { productId: "p1", quantity: 2, unit: "kg", product: tomatoes },
          { productId: "p2", quantity: 10, unit: "loaf", product: bread },
        ],
      },
      { date: d("2026-11-22"), items: [{ productId: "p2", quantity: 6, unit: "loaf", product: bread }] },
    ];

    const totals = totalSales(WEEK, entries);

    expect(totals.byProduct).toEqual([
      { productId: "p1", name: "Tomatoes", unit: "kg", quantity: 2 },
      { productId: "p2", name: "Bread", unit: "loaf", quantity: 16 },
    ]);
    expect(totals.byDay.map((day) => day.quantity)).toEqual([12, 0, 0, 0, 0, 0, 6]);
    expect(totals.byProductByDay.map((product) => product.daily)).toEqual([
      [2, 0, 0, 0, 0, 0, 0],
      [10, 0, 0, 0, 0, 0, 6],
    ]);
  });

  it("refuses a Sales entry from outside the window", () => {
    const entries: SalesEntryRow[] = [
      { date: d("2026-11-23"), items: [{ productId: "p1", quantity: 1, unit: "kg", product: tomatoes }] },
    ];

    expect(() => totalSales(WEEK, entries)).toThrow(RangeError);
  });
});
