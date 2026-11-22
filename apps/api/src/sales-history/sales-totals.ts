import { BusinessDate, type DateWindow } from "../calendar/business-date.js";

/** One Sales entry as the Sales history query reads it. */
export interface SalesEntryRow {
  date: BusinessDate;
  items: {
    productId: string;
    quantity: number;
    unit: string | null;
    product: { name: string; defaultUnit: string | null };
  }[];
}

/** One Product's Sales items added up over the whole window. */
export interface ProductTotal {
  productId: string;
  name: string;
  unit: string | null;
  quantity: number;
}

/** All Sales items of one Business date added up. */
export interface DayTotal {
  date: BusinessDate;
  quantity: number;
}

/** One Product's Sales items per day, one number for each day of the window. */
export interface ProductDailyTotals {
  productId: string;
  name: string;
  unit: string | null;
  daily: number[];
}

/** What `SalesHistory.read()` returns for one window. */
export interface SalesTotals {
  byProduct: ProductTotal[];
  byDay: DayTotal[];
  byProductByDay: ProductDailyTotals[];
}

/**
 * Adds up the Sales items of `entries` per Product, per day and per Product
 * per day. Every day of `window` is in `byDay` and in each `daily`, with 0
 * when nothing sold; Products appear in the order they're first seen.
 * Quantities are not rounded.
 *
 * Kept from the Legacy API (ADR-023 §2): a Product's unit is the first one
 * seen (`item.unit`, else the Product's default unit), and quantities in
 * different units are added together.
 */
export function totalSales(window: DateWindow, entries: readonly SalesEntryRow[]): SalesTotals {
  const days = BusinessDate.daysOf(window);
  const dayIndex = new Map(days.map((date, index) => [date, index]));
  const byDay = days.map((date) => ({ date, quantity: 0 }));
  const products = new Map<string, ProductDailyTotals & { quantity: number }>();

  for (const entry of entries) {
    const index = dayIndex.get(entry.date);
    if (index === undefined) throw new RangeError(`Sales entry date ${entry.date} is outside ${window.from} to ${window.to}`);
    for (const item of entry.items) {
      let product = products.get(item.productId);
      if (!product) {
        product = {
          productId: item.productId,
          name: item.product.name,
          unit: item.unit ?? item.product.defaultUnit,
          quantity: 0,
          daily: days.map(() => 0),
        };
        products.set(item.productId, product);
      }
      product.quantity += item.quantity;
      product.daily[index]! += item.quantity;
      byDay[index]!.quantity += item.quantity;
    }
  }

  const all = [...products.values()];
  return {
    byProduct: all.map(({ productId, name, unit, quantity }) => ({ productId, name, unit, quantity })),
    byDay,
    byProductByDay: all.map(({ productId, name, unit, daily }) => ({ productId, name, unit, daily })),
  };
}
