import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { DatabaseModule } from "../database/database.module.js";
import { HealthController } from "./health.controller.js";

@Module({
  // HealthController logs failed checks itself, with structured fields.
  imports: [TerminusModule.forRoot({ logger: false }), DatabaseModule],
  controllers: [HealthController],
})
export class HealthModule {}
