import type { Prisma } from "@freshcast/db";

// The rules the scoped Prisma client applies to every query, as pure
// functions of (model, operation, args), so they can be tested without a
// database (ADR-025). scoped-prisma.ts plugs them into a Prisma client
// extension.
//
// Fail closed: a model, operation, nested write or relation these rules
// don't know throws instead of running unscoped.

type ModelName = Prisma.ModelName;

/** Relation fields of a model, from Prisma's generated payload types. */
type RelationField<M extends ModelName> = keyof Prisma.TypeMap["model"][M]["payload"]["objects"] & string;

/**
 * How each model is scoped to a Business:
 * - `owned`: has its own `businessId`.
 * - `business`: the Business row itself, matched by `id`.
 * - `salesEntry`: a Sales item, owned through its Sales entry.
 * - `unscoped`: auth tables; only the unscoped PrismaService may touch them.
 *
 * A Record over every model name, so adding a model fails typecheck until
 * it is classified here.
 */
export const MODEL_SCOPES = {
  User: "unscoped",
  Account: "unscoped",
  Session: "unscoped",
  VerificationToken: "unscoped",
  Business: "business",
  Product: "owned",
  SalesEntry: "owned",
  SalesItem: "salesEntry",
  DailyInsight: "owned",
  DemandForecast: "owned",
} as const satisfies Record<ModelName, "owned" | "business" | "salesEntry" | "unscoped">;

type ScopedModel = { [M in ModelName]: (typeof MODEL_SCOPES)[M] extends "unscoped" ? never : M }[ModelName];

/**
 * Every relation field and the model it points to, so writes can be
 * checked for nested writes and reads for paths into the auth tables. The
 * mapped type makes it complete: a new relation fails typecheck until it is
 * listed here.
 */
const RELATIONS: { [M in ModelName]: { [F in RelationField<M>]: ModelName } } = {
  User: { accounts: "Account", sessions: "Session", business: "Business" },
  Account: { user: "User" },
  Session: { user: "User" },
  VerificationToken: {},
  Business: {
    user: "User",
    products: "Product",
    salesEntries: "SalesEntry",
    dailyInsights: "DailyInsight",
    demandForecasts: "DemandForecast",
  },
  Product: { business: "Business", salesItems: "SalesItem", demandForecasts: "DemandForecast" },
  SalesEntry: { business: "Business", items: "SalesItem" },
  SalesItem: { salesEntry: "SalesEntry", product: "Product" },
  DailyInsight: { business: "Business" },
  DemandForecast: { business: "Business", product: "Product" },
};

/**
 * Nested writes the scoped client allows. Each one only reaches rows under
 * a parent the scope already matched: a Sales entry's own Sales items. The
 * items' own data is checked like any other write, so it can't carry a
 * relation, and its `productId` is checked for ownership. `connect`, `set`
 * and the like are never allowed: they could attach another Business's row.
 */
const NESTED_WRITES: Partial<Record<ModelName, Partial<Record<string, readonly NestedOp[]>>>> = {
  SalesEntry: { items: ["create", "createMany", "deleteMany"] },
};
type NestedOp = "create" | "createMany" | "deleteMany";

/**
 * Foreign keys a write may set to another Business-owned row. The scoped
 * client checks each value belongs to the Business before the write
 * (`referencedIds`). Owner keys (`businessId`, `salesEntryId`) are handled
 * separately and never change.
 */
const FOREIGN_KEYS: Partial<Record<ModelName, Record<string, OwnedModel>>> = {
  SalesItem: { productId: "Product" },
  DemandForecast: { productId: "Product" },
};

/** Business-owned models a foreign key can point at. */
export type OwnedModel = "Product";

const READS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);
const UPDATES = new Set(["update", "updateMany", "updateManyAndReturn"]);
const DELETES = new Set(["delete", "deleteMany"]);
const CREATES = new Set(["create", "createMany", "createManyAndReturn"]);

/** A query the scoped client refuses to run. A programming error, so a 500. */
export class ScopeViolationError extends Error {
  override name = "ScopeViolationError";
}

type Args = Record<string, unknown>;

/**
 * Returns `args` with the Business scope applied, or throws
 * ScopeViolationError. Never mutates `args`.
 */
export function scopeArgs(model: string, operation: string, args: Args | undefined, businessId: string): Args {
  const m = scopedModel(model);
  const scope = MODEL_SCOPES[m];
  const a: Args = { ...args };
  const filter = scopeFilter(m, businessId);
  checkSelection(m, a);

  if (READS.has(operation)) return withWhere(a, filter);

  if (scope === "business" && !UPDATES.has(operation)) {
    throw new ScopeViolationError(`Business allows only reads and updates on the scoped client, not ${operation}`);
  }
  if (scope === "salesEntry" && (CREATES.has(operation) || operation === "upsert")) {
    throw new ScopeViolationError("Create Sales items through their Sales entry");
  }

  if (UPDATES.has(operation)) {
    checkWriteData(m, a.data);
    return withWhere(a, filter);
  }
  if (DELETES.has(operation)) return withWhere(a, filter);
  if (CREATES.has(operation)) {
    const data = Array.isArray(a.data) ? a.data.map((d) => createData(m, d, businessId)) : createData(m, a.data, businessId);
    return { ...a, data };
  }
  if (operation === "upsert") {
    checkWriteData(m, a.update);
    return { ...withWhere(a, filter), create: createData(m, a.create, businessId) };
  }
  throw new ScopeViolationError(`Unknown operation ${model}.${operation}`);
}

/**
 * The IDs of Business-owned rows a write stores as foreign keys, such as
 * each Sales item's `productId`, including in nested items. The scoped
 * client checks they belong to the Business: the scope filters which rows
 * a query matches, not the IDs written into them (#110). Call it after
 * scopeArgs has accepted the args.
 */
export function referencedIds(model: string, operation: string, args: Args | undefined): Partial<Record<OwnedModel, string[]>> {
  const found: Partial<Record<OwnedModel, Set<string>>> = {};
  const m = model as ModelName;
  const a = args ?? {};
  const payloads = CREATES.has(operation)
    ? toArray(a.data)
    : UPDATES.has(operation)
      ? [a.data]
      : operation === "upsert"
        ? [a.create, a.update]
        : [];
  for (const data of payloads) collectReferences(m, data, found);
  return Object.fromEntries(Object.entries(found).map(([target, ids]) => [target, [...ids]]));
}

function collectReferences(model: ModelName, data: unknown, found: Partial<Record<OwnedModel, Set<string>>>): void {
  if (!isRecord(data)) return;
  for (const [field, target] of Object.entries(FOREIGN_KEYS[model] ?? {})) {
    const value = data[field];
    const id = isRecord(value) ? value.set : value;
    if (typeof id === "string") (found[target] ??= new Set()).add(id);
  }
  for (const [field, ops] of Object.entries(NESTED_WRITES[model] ?? {})) {
    const nested = data[field];
    if (!isRecord(nested) || !ops) continue;
    const child = (RELATIONS[model] as Record<string, ModelName>)[field]!;
    for (const payload of nestedPayloads(nested)) collectReferences(child, payload, found);
  }
}

function scopedModel(model: string): ScopedModel {
  const scope = MODEL_SCOPES[model as ModelName];
  if (!scope) throw new ScopeViolationError(`Unknown model ${model}`);
  if (scope === "unscoped") {
    throw new ScopeViolationError(`${model} isn't available on the scoped client; use PrismaService in a documented place`);
  }
  return model as ScopedModel;
}

function scopeFilter(model: ModelName, businessId: string): Args {
  switch (MODEL_SCOPES[model]) {
    case "business":
      return { id: businessId };
    case "salesEntry":
      return { salesEntry: { businessId } };
    default:
      return { businessId };
  }
}

/**
 * Adds the filter under AND, alongside the caller's own conditions. AND is
 * allowed next to unique fields, so this works for findUnique, update and
 * delete too, and a caller's `businessId` can only narrow the result.
 */
function withWhere(args: Args, filter: Args): Args {
  const where = (args.where ?? {}) as Args;
  const and = where.AND === undefined ? [] : Array.isArray(where.AND) ? where.AND : [where.AND];
  return { ...args, where: { ...where, AND: [...and, filter] } };
}

/**
 * Refuses `include` or `select` paths into the auth tables, at any depth,
 * such as a Business's `user` and its accounts' OAuth tokens. `_count`
 * returns only numbers, so it isn't checked.
 */
function checkSelection(model: ModelName, args: Args): void {
  for (const key of ["include", "select"] as const) {
    const tree = args[key];
    if (!isRecord(tree)) continue;
    for (const [field, value] of Object.entries(tree)) {
      const target = (RELATIONS[model] as Record<string, ModelName | undefined>)[field];
      if (!target || !value) continue;
      if (MODEL_SCOPES[target] === "unscoped") {
        throw new ScopeViolationError(`Can't read ${model}.${field} through the scoped client`);
      }
      if (isRecord(value)) checkSelection(target, value);
    }
  }
}

/** Fields that tie a row to its owner; writes may not set or change them. */
const OWNER_FIELDS: Record<"owned" | "business" | "salesEntry", readonly string[]> = {
  owned: ["businessId"],
  business: ["id", "userId"],
  salesEntry: ["salesEntryId"],
};

function checkWriteData(model: ModelName, data: unknown): void {
  const record = asRecord(data);
  const scope = MODEL_SCOPES[model] as keyof typeof OWNER_FIELDS;
  for (const field of OWNER_FIELDS[scope]) {
    if (field in record) throw new ScopeViolationError(`Can't set ${model}.${field} on the scoped client`);
  }
  checkNestedWrites(model, record);
}

function createData(model: ModelName, data: unknown, businessId: string): Args {
  const record = asRecord(data);
  if ("businessId" in record && record.businessId !== businessId) {
    throw new ScopeViolationError(`Can't create a ${model} for another Business`);
  }
  checkNestedWrites(model, record);
  return { ...record, businessId };
}

function checkNestedWrites(model: ModelName, data: Args): void {
  const relations = RELATIONS[model] as Record<string, ModelName>;
  for (const [field, child] of Object.entries(relations)) {
    if (data[field] === undefined) continue;
    const allowed = NESTED_WRITES[model]?.[field];
    if (!allowed) throw new ScopeViolationError(`Nested write to ${model}.${field} isn't allowed on the scoped client`);
    const nested = asRecord(data[field]);
    for (const op of Object.keys(nested)) {
      if (!allowed.includes(op as NestedOp)) {
        throw new ScopeViolationError(`Nested ${op} on ${model}.${field} isn't allowed on the scoped client`);
      }
    }
    // The nested rows' own data gets the same checks, recursively: no owner
    // fields and no nested writes of their own beyond NESTED_WRITES.
    for (const payload of nestedPayloads(nested)) checkWriteData(child, payload);
  }
}

/** The row data inside a nested write: `create` and `createMany.data`. */
function nestedPayloads(nested: Args): unknown[] {
  const createMany = nested.createMany;
  return [...toArray(nested.create), ...(isRecord(createMany) ? toArray(createMany.data) : [])];
}

function toArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isRecord(value: unknown): value is Args {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Args {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new ScopeViolationError("Expected an object of fields");
  return value;
}
