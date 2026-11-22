import { Injectable } from "@nestjs/common";
import { BusinessDate, type DateWindow } from "../calendar/business-date.js";
import { InjectScopedPrisma, type ScopedPrismaClient } from "../database/scoped-prisma.js";
import { type SalesTotals, totalSales } from "./sales-totals.js";

/**
 * Sales history: the request's Business's Sales items totalled over a
 * window of Business dates, per Product, per day and per Product per day.
 * The one read path for these totals; the Business comes from the scoped
 * client (ADR-025), never from an argument.
 */
@Injectable()
export class SalesHistory {
  constructor(@InjectScopedPrisma() private readonly db: ScopedPrismaClient) {}

  /**
   * Both ends of `window` are included. To compare two windows, call it
   * twice in parallel. Quantities are not rounded; callers round.
   */
  async read(window: DateWindow): Promise<SalesTotals> {
    const entries = await this.db.salesEntry.findMany({
      where: { date: { gte: BusinessDate.toDbDate(window.from), lte: BusinessDate.toDbDate(window.to) } },
      // A fixed order, so "the first unit seen" is the same on every read.
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      select: {
        date: true,
        items: {
          orderBy: { id: "asc" },
          select: { productId: true, quantity: true, unit: true, product: { select: { name: true, defaultUnit: true } } },
        },
      },
    });
    return totalSales(
      window,
      entries.map((entry) => ({ ...entry, date: BusinessDate.fromDbDate(entry.date) }))
    );
  }
}
