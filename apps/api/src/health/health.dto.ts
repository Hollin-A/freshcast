import { createZodDto } from "nestjs-zod";
import { healthLiveSchema, healthReadySchema, healthUnavailableSchema } from "@freshcast/shared";

export class HealthLiveDto extends createZodDto(healthLiveSchema) {}
export class HealthReadyDto extends createZodDto(healthReadySchema) {}
export class HealthUnavailableDto extends createZodDto(healthUnavailableSchema) {}
