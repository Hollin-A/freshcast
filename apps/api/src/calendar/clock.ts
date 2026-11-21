import { Injectable } from "@nestjs/common";

/**
 * Where the API reads "now". Inject it rather than calling `new Date()`, so
 * tests can pin the time without faking the global clock (which would also
 * move session expiry, log timestamps and Prisma's `updatedAt`).
 *
 * An abstract class so it is also the injection token.
 */
export abstract class Clock {
  abstract now(): Date;
}

/** The real time. Provided everywhere outside tests. */
@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** A time that only moves when a test moves it. */
export class FixedClock extends Clock {
  private instant: number;

  constructor(instant: Date) {
    super();
    this.instant = FixedClock.check(instant);
  }

  now(): Date {
    return new Date(this.instant);
  }

  set(instant: Date): void {
    this.instant = FixedClock.check(instant);
  }

  private static check(instant: Date): number {
    const ms = instant.getTime();
    if (Number.isNaN(ms)) throw new RangeError("FixedClock needs a valid Date");
    return ms;
  }
}
