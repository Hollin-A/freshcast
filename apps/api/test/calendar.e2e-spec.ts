import { Controller, Get, type INestApplication, Module } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SessionBusiness } from "../src/auth/auth-context.js";
import { CurrentBusiness } from "../src/auth/current-session.decorator.js";
import { BusinessCalendar } from "../src/calendar/business-calendar.js";
import { CalendarModule } from "../src/calendar/calendar.module.js";
import { FixedClock } from "../src/calendar/clock.js";
import type { PrismaService } from "../src/database/prisma.service.js";
import { type Fixtures, seedFixtures } from "./fixtures.js";
import { createE2eApp, resetDatabase } from "./harness.js";

// The harness pins "now" by replacing the Clock provider, without faking
// the global clock: sessions, logs and Prisma keep real time. No route reads
// the calendar yet, so a test-only controller stands in for one.

@Controller("e2e-calendar")
class CalendarProbeController {
  constructor(private readonly calendar: BusinessCalendar) {}

  @Get("today")
  today(@CurrentBusiness() business: SessionBusiness) {
    const { today, tomorrow } = this.calendar.forBusiness(business);
    return { today, tomorrow };
  }
}

@Module({ imports: [CalendarModule], controllers: [CalendarProbeController] })
class CalendarProbeModule {}

describe("business calendar (e2e)", () => {
  // 00:30 on the 22nd in Melbourne (alpha), 21:30 on the 21st in Perth (beta).
  const PINNED = new Date("2026-11-21T13:30:00.000Z");
  const clock = new FixedClock(PINNED);
  let app: INestApplication;
  let prisma: PrismaService;
  let fx: Fixtures;

  beforeAll(async () => {
    ({ app, prisma } = await createE2eApp({ imports: [CalendarProbeModule], clock }));
  });

  beforeEach(async () => {
    clock.set(PINNED);
    await resetDatabase(prisma);
    fx = await seedFixtures(prisma);
  });

  afterAll(async () => {
    await app?.close();
  });

  const today = (cookie: string) => request(app.getHttpServer()).get("/e2e-calendar/today").set("Cookie", cookie);

  it("answers each Business's date at the pinned instant", async () => {
    expect((await today(fx.alpha.cookie).expect(200)).body).toEqual({ today: "2026-11-22", tomorrow: "2026-11-23" });
    expect((await today(fx.beta.cookie).expect(200)).body).toEqual({ today: "2026-11-21", tomorrow: "2026-11-22" });
  });

  it("follows the pinned clock when a test moves it", async () => {
    // 03:00 on the 22nd in Perth.
    clock.set(new Date("2026-11-21T19:00:00.000Z"));
    expect((await today(fx.beta.cookie).expect(200)).body).toEqual({ today: "2026-11-22", tomorrow: "2026-11-23" });
  });
});
