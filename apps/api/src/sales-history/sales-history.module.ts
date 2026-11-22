import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module.js";
import { SalesHistory } from "./sales-history.js";

/**
 * Sales history for feature modules: import it, inject `SalesHistory` and
 * call `read(window)` with a window from `BusinessCalendar`.
 */
@Module({
  imports: [DatabaseModule],
  providers: [SalesHistory],
  exports: [SalesHistory],
})
export class SalesHistoryModule {}
