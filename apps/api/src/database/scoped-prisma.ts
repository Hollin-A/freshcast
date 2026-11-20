import { Inject } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@freshcast/db";
import { ApiException } from "../common/api-exception.js";
import { MODEL_SCOPES, referencedIds, scopeArgs, ScopeViolationError } from "./business-scope.js";

// The scoped Prisma client (ADR-025): one client for the whole process that
// adds the current request's Business to every query. Services inject it
// with @InjectScopedPrisma() and leave businessId out of their queries; the
// Business comes from the request context SessionGuard fills
// (business-context.ts).

function extend(prisma: PrismaClient, currentBusinessId: () => string) {
  return prisma.$extends({
    name: "business-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // Read per query, so the one client serves every request.
          const businessId = currentBusinessId();
          const scoped = scopeArgs(model, operation, args as Record<string, unknown>, businessId);
          const { Product: productIds = [] } = referencedIds(model, operation, args as Record<string, unknown>);
          // Checked with the unscoped client and an explicit businessId, so
          // inside a $transaction it sees committed Products only.
          await rejectUnowned(productIds, "productId", (wanted) =>
            prisma.product.findMany({ where: { id: { in: wanted }, businessId }, select: { id: true } })
          );
          return query(scoped);
        },
      },
    },
  });
}

type Extended = ReturnType<typeof extend>;

/** Client properties of the models the scoped client serves. */
type Delegate = Uncapitalize<
  { [M in keyof typeof MODEL_SCOPES]: (typeof MODEL_SCOPES)[M] extends "unscoped" ? never : M }[keyof typeof MODEL_SCOPES]
>;
const delegateOf = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);
const DELEGATES = new Set(
  Object.entries(MODEL_SCOPES)
    .filter(([, scope]) => scope !== "unscoped")
    .map(([model]) => delegateOf(model))
);
const UNSCOPED_DELEGATES = new Set(
  Object.entries(MODEL_SCOPES)
    .filter(([, scope]) => scope === "unscoped")
    .map(([model]) => delegateOf(model))
);

/** Models `$assertOwned()` checks, by their client property. */
export type AssertableModel = "product" | "salesEntry" | "dailyInsight" | "demandForecast";

const LABELS: Record<AssertableModel, string> = {
  product: "Product",
  salesEntry: "Sales entry",
  dailyInsight: "Insight",
  demandForecast: "Forecast",
};

type AssertOwned = (model: AssertableModel, ids: readonly string[], field?: string) => Promise<void>;

/**
 * The client a scoped `$transaction` passes to its callback: the same
 * delegates and `$assertOwned()`, without `$transaction`.
 */
export type ScopedTransactionClient = Pick<Extended, Delegate> & {
  /**
   * Rejects IDs from a request body that don't belong to the Business with
   * 400 VALIDATION_ERROR, listing them under `field`. Writes check the
   * foreign keys they store anyway (each Sales item's `productId`); call
   * this first to name the request field, or to check IDs that aren't
   * written, such as a filter.
   */
  $assertOwned: AssertOwned;
};

/**
 * The client services see: the Business-owned model delegates,
 * `$assertOwned()` and `$transaction`. Nothing else: the auth tables
 * belong to PrismaService, raw SQL (`$queryRaw`, `$executeRaw` and the
 * `Unsafe` variants) and `$extends` would skip the scope, and so would the
 * connection methods. The same holds at runtime, including on the
 * transaction client.
 */
export type ScopedPrismaClient = ScopedTransactionClient & {
  $transaction<R>(
    fn: (tx: ScopedTransactionClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<R>;
  $transaction<P extends Prisma.PrismaPromise<unknown>[]>(
    queries: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel }
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
};

export function createScopedClient(prisma: PrismaClient, businessId: () => string): ScopedPrismaClient {
  return guard(extend(prisma, businessId)) as unknown as ScopedPrismaClient;
}

/** `$assertOwned()` on a scoped client or transaction client. */
function assertOwnedOn(client: object): AssertOwned {
  return (model, ids, field = `${model}Id`) =>
    rejectUnowned(ids, field, (wanted) =>
      (client as Record<AssertableModel, { findMany(args: object): Promise<{ id: string }[]> }>)[model].findMany({
        where: { id: { in: wanted } },
        select: { id: true },
      }),
      LABELS[model]
    );
}

async function rejectUnowned(
  ids: readonly string[],
  field: string,
  findOwned: (ids: string[]) => Promise<{ id: string }[]>,
  label = "Product"
): Promise<void> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return;
  const found = new Set((await findOwned(wanted)).map((row) => row.id));
  const unknown = wanted.filter((id) => !found.has(id));
  if (unknown.length > 0) {
    throw new ApiException("VALIDATION_ERROR", `Some IDs don't match a ${label} of this Business.`, 400, {
      errors: { [field]: unknown.map((id) => `Unknown ${label} ID: ${id}`) },
    });
  }
}

/**
 * Exposes only the scoped model delegates, `$transaction` and
 * `$assertOwned`, on the client and on the transaction client
 * `$transaction` passes to its callback. An allowlist: the extended client
 * also inherits PrismaService's methods, including the lifecycle hooks Nest
 * would otherwise call on this provider too. Other `$` methods throw, so a
 * mistake is loud, as do the auth-table delegates; anything else reads as
 * undefined.
 */
function guard<T extends object>(client: T): T {
  const $assertOwned = assertOwnedOn(client);
  return new Proxy(client, {
    get(target, prop) {
      if (typeof prop !== "string") return undefined;
      if (prop === "$assertOwned") return $assertOwned;
      if ((prop.startsWith("$") && prop !== "$transaction") || UNSCOPED_DELEGATES.has(prop)) {
        throw new ScopeViolationError(`${prop} isn't available on the scoped client; use PrismaService in a documented place`);
      }
      if (!DELEGATES.has(prop) && prop !== "$transaction") return undefined;
      const value = Reflect.get(target, prop) as unknown;
      if (prop === "$transaction" && typeof value === "function") {
        return (arg: unknown, options?: unknown) =>
          typeof arg === "function"
            ? value.call(target, (tx: object) => (arg as (tx: object) => unknown)(guard(tx)), options)
            : value.call(target, arg, options);
      }
      return value;
    },
  });
}

/** The injection token for the scoped client; inject it with @InjectScopedPrisma(). */
export const SCOPED_PRISMA = Symbol("ScopedPrisma");

/**
 * Injects the scoped client:
 * `constructor(@InjectScopedPrisma() private readonly db: ScopedPrismaClient) {}`
 */
export const InjectScopedPrisma = (): ParameterDecorator => Inject(SCOPED_PRISMA);
