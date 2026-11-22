import { Controller, Get, type INestApplication, Module, Query } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { SessionBusiness } from "../src/auth/auth-context.js";
import { CurrentBusiness } from "../src/auth/current-session.decorator.js";
import { BusinessCalendar } from "../src/calendar/business-calendar.js";
import { BusinessDate } from "../src/calendar/business-date.js";
import { CalendarModule } from "../src/calendar/calendar.module.js";
import { FixedClock } from "../src/calendar/clock.js";
import type { PrismaService } from "../src/database/prisma.service.js";
import { SalesHistory } from "../src/sales-history/sales-history.js";
import { SalesHistoryModule } from "../src/sales-history/sales-history.module.js";
import { type Fixtures, seedFixtures } from "./fixtures.js";
import { createE2eApp, resetDatabase } from "./harness.js";

// Sales history reads through the scoped client, so each Business sees only
// its own Sales items, and windows of Business dates include both ends. No
// route reads it yet (#36, #39, #41, #42 will), so a test-only controller
// stands in for one.

class WindowDto extends createZodDto(z.object({ from: z.iso.date(), to: z.iso.date() })) {}

@Controller("e2e-sales-history")
class SalesHistoryProbeController {
  constructor(
    private readonly calendar: BusinessCalendar,
    private readonly salesHistory: SalesHistory
  ) {}

  @Get("this-week")
  thisWeek(@CurrentBusiness() business: SessionBusiness) {
    return this.salesHistory.read(this.calendar.forBusiness(business).trailing(7));
  }

  @Get()
  window(@Query() { from, to }: WindowDto) {
    return this.salesHistory.read({ from: BusinessDate.parse(from), to: BusinessDate.parse(to) });
  }
}

@Module({ imports: [CalendarModule, SalesHistoryModule], controllers: [SalesHistoryProbeController] })
class SalesHistoryProbeModule {}

describe("Sales history (e2e)", () => {
  // 00:30 on the 22nd in Melbourne (alpha), 21:30 on the 21st in Perth (beta).
  const clock = new FixedClock(new Date("2026-11-21T13:30:00.000Z"));
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: Fixtures;

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp({ imports: [SalesHistoryProbeModule], clock }));
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    fx = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const sell = (business: Fixtures["alpha"], date: string, quantity: number) =>
    prisma.salesEntry.create({
      data: {
        businessId: business.businessId,
        date: BusinessDate.toDbDate(BusinessDate.parse(date)),
        items: { create: { productId: business.productId, quantity, unit: "kg" } },
      },
    });

  const get = (path: string, cookie: string) =>
    request(app.getHttpServer()).get(`/e2e-sales-history${path}`).set("Cookie", cookie).expect(200);

  it("totals this week of the session's Business, both ends included", async () => {
    // Alpha's this week is 2026-11-16 to 2026-11-22.
    await sell(fx.alpha, "2026-11-15", 100); // the day before
    await sell(fx.alpha, "2026-11-16", 1);
    await sell(fx.alpha, "2026-11-22", 2);
    await sell(fx.alpha, "2026-11-22", 0.5);
    await sell(fx.alpha, "2026-11-23", 100); // the day after

    const { body } = await get("/this-week", fx.alpha.cookie);

    expect(body.byProduct).toEqual([{ productId: fx.alpha.productId, name: "Tomatoes", unit: "kg", quantity: 3.5 }]);
    expect(body.byDay).toEqual([
      { date: "2026-11-16", quantity: 1 },
      { date: "2026-11-17", quantity: 0 },
      { date: "2026-11-18", quantity: 0 },
      { date: "2026-11-19", quantity: 0 },
      { date: "2026-11-20", quantity: 0 },
      { date: "2026-11-21", quantity: 0 },
      { date: "2026-11-22", quantity: 2.5 },
    ]);
    expect(body.byProductByDay).toEqual([
      { productId: fx.alpha.productId, name: "Tomatoes", unit: "kg", daily: [1, 0, 0, 0, 0, 0, 2.5] },
    ]);
  });

  it("uses each Business's own today for its week", async () => {
    // Beta, in Perth, is still on the 21st: its week is 2026-11-15 to 2026-11-21.
    await sell(fx.beta, "2026-11-15", 4);
    await sell(fx.beta, "2026-11-22", 100);

    const { body } = await get("/this-week", fx.beta.cookie);

    expect(body.byDay[0]).toEqual({ date: "2026-11-15", quantity: 4 });
    expect(body.byDay.at(-1)).toEqual({ date: "2026-11-21", quantity: 0 });
    expect(body.byProduct).toEqual([{ productId: fx.beta.productId, name: "Tomatoes", unit: "kg", quantity: 4 }]);
  });

  it("never returns another Business's Sales items", async () => {
    await sell(fx.alpha, "2026-11-20", 3);
    await sell(fx.beta, "2026-11-20", 7);

    const alpha = (await get("?from=2026-11-20&to=2026-11-20", fx.alpha.cookie)).body;
    const beta = (await get("?from=2026-11-20&to=2026-11-20", fx.beta.cookie)).body;

    expect(alpha.byProduct).toEqual([{ productId: fx.alpha.productId, name: "Tomatoes", unit: "kg", quantity: 3 }]);
    expect(alpha.byDay).toEqual([{ date: "2026-11-20", quantity: 3 }]);
    expect(beta.byProduct).toEqual([{ productId: fx.beta.productId, name: "Tomatoes", unit: "kg", quantity: 7 }]);
  });
});
