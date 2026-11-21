import { Module } from "@nestjs/common";
import { BusinessCalendar } from "./business-calendar.js";
import { Clock, SystemClock } from "./clock.js";

/**
 * Business dates (ADR-013). Import it in a feature module and inject
 * `BusinessCalendar`; inject `Clock` only for instants that aren't dates.
 * Tests replace `Clock` with a `FixedClock` (`overrideProvider(Clock)`).
 */
@Module({
  providers: [{ provide: Clock, useClass: SystemClock }, BusinessCalendar],
  exports: [Clock, BusinessCalendar],
})
export class CalendarModule {}
