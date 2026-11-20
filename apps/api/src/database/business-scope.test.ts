import { describe, expect, it } from "vitest";
import { MODEL_SCOPES, referencedIds, scopeArgs, ScopeViolationError } from "./business-scope.js";

// The scoping rules, operation by operation. Against a real database, with
// two Businesses, in test/isolation.e2e-spec.ts.

const BIZ = "biz_alpha";
const OWNED = ["Product", "SalesEntry", "DailyInsight", "DemandForecast"] as const;
const WHERE_OPS = [
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
] as const;

const violation = (fn: () => unknown, message?: RegExp) => expect(fn).toThrow(message ?? ScopeViolationError);

describe("scopeArgs on Business-owned models", () => {
  describe.each(OWNED)("%s", (model) => {
    it.each(WHERE_OPS)("%s adds businessId to where", (op) => {
      const data = op.startsWith("update") ? { data: { name: "x" } } : {};
      expect(scopeArgs(model, op, { where: { id: "p1" }, ...data }, BIZ)).toEqual({
        where: { id: "p1", AND: [{ businessId: BIZ }] },
        ...data,
      });
    });

    it("scopes a query with no where", () => {
      expect(scopeArgs(model, "findMany", undefined, BIZ)).toEqual({ where: { AND: [{ businessId: BIZ }] } });
    });

    it.each(["create", "createMany", "createManyAndReturn"])("%s sets businessId", (op) => {
      expect(scopeArgs(model, op, { data: { name: "x" } }, BIZ)).toEqual({ data: { name: "x", businessId: BIZ } });
    });

    it("sets businessId on each row of a createMany", () => {
      expect(scopeArgs(model, "createMany", { data: [{ n: 1 }, { n: 2 }] }, BIZ)).toEqual({
        data: [
          { n: 1, businessId: BIZ },
          { n: 2, businessId: BIZ },
        ],
      });
    });

    it("upsert scopes where and sets businessId on create", () => {
      expect(scopeArgs(model, "upsert", { where: { id: "p1" }, create: { n: 1 }, update: { n: 2 } }, BIZ)).toEqual({
        where: { id: "p1", AND: [{ businessId: BIZ }] },
        create: { n: 1, businessId: BIZ },
        update: { n: 2 },
      });
    });

    it("refuses to create a row for another Business", () => {
      violation(() => scopeArgs(model, "create", { data: { businessId: "biz_beta" } }, BIZ), /another Business/);
      violation(() => scopeArgs(model, "upsert", { where: { id: "p1" }, create: { businessId: "biz_beta" }, update: {} }, BIZ));
    });

    it("allows the session's own businessId on create", () => {
      expect(scopeArgs(model, "create", { data: { businessId: BIZ } }, BIZ)).toEqual({ data: { businessId: BIZ } });
    });

    it.each(["update", "updateMany", "updateManyAndReturn"])("%s can't move a row to another Business", (op) => {
      violation(() => scopeArgs(model, op, { where: { id: "p1" }, data: { businessId: "biz_beta" } }, BIZ), /businessId/);
    });

    it("upsert's update can't move a row to another Business", () => {
      violation(() => scopeArgs(model, "upsert", { where: { id: "p1" }, create: {}, update: { businessId: "biz_beta" } }, BIZ));
    });

    it("refuses connecting the business relation", () => {
      violation(() => scopeArgs(model, "create", { data: { business: { connect: { id: "biz_beta" } } } }, BIZ), /Nested write/);
    });
  });

  it("keeps the caller's AND conditions, so a caller's businessId can only narrow", () => {
    expect(
      scopeArgs("Product", "findMany", { where: { businessId: "biz_beta", AND: { isActive: true } } }, BIZ)
    ).toEqual({ where: { businessId: "biz_beta", AND: [{ isActive: true }, { businessId: BIZ }] } });
    expect(scopeArgs("Product", "findMany", { where: { AND: [{ a: 1 }, { b: 2 }] } }, BIZ)).toEqual({
      where: { AND: [{ a: 1 }, { b: 2 }, { businessId: BIZ }] },
    });
  });

  it("leaves select, include, orderBy and paging alone", () => {
    const args = { select: { id: true }, include: undefined, orderBy: { name: "asc" }, take: 5, skip: 10 };
    expect(scopeArgs("Product", "findMany", args, BIZ)).toEqual({ ...args, where: { AND: [{ businessId: BIZ }] } });
  });

  it("doesn't mutate the caller's args", () => {
    const args = { where: { id: "p1" }, data: { name: "x" } };
    const copy = structuredClone(args);
    scopeArgs("Product", "update", args, BIZ);
    expect(args).toEqual(copy);
  });

  it("refuses nested writes to other Business-owned rows", () => {
    violation(() => scopeArgs("Product", "update", { where: { id: "p1" }, data: { demandForecasts: { create: {} } } }, BIZ));
    violation(() => scopeArgs("Product", "update", { where: { id: "p1" }, data: { salesItems: { connect: [{ id: "i1" }] } } }, BIZ));
    violation(() => scopeArgs("DemandForecast", "create", { data: { product: { connect: { id: "p_beta" } } } }, BIZ));
  });
});

describe("scopeArgs on Sales entries' nested Sales items", () => {
  it.each(["create", "createMany", "deleteMany"])("allows items.%s", (op) => {
    const data = { date: "2026-11-20", items: { [op]: {} } };
    expect(scopeArgs("SalesEntry", "create", { data }, BIZ)).toEqual({ data: { ...data, businessId: BIZ } });
    expect(scopeArgs("SalesEntry", "update", { where: { id: "e1" }, data }, BIZ).data).toEqual(data);
  });

  it.each(["connect", "connectOrCreate", "set", "disconnect", "upsert", "update", "updateMany", "delete"])(
    "refuses items.%s",
    (op) => {
      violation(
        () => scopeArgs("SalesEntry", "update", { where: { id: "e1" }, data: { items: { [op]: {} } } }, BIZ),
        new RegExp(`Nested ${op}`)
      );
    }
  );
});

describe("scopeArgs on the data inside nested Sales items", () => {
  const entryWith = (items: unknown) => ({ data: { businessId: BIZ, date: "2026-11-20", items } });

  it("allows items that only set scalars, including productId", () => {
    expect(() => scopeArgs("SalesEntry", "create", entryWith({ create: [{ productId: "p1", quantity: 1 }] }), BIZ)).not.toThrow();
    expect(() =>
      scopeArgs("SalesEntry", "create", entryWith({ createMany: { data: [{ productId: "p1", quantity: 1 }] } }), BIZ)
    ).not.toThrow();
  });

  it.each([
    ["connects another Business's Product", { product: { connect: { id: "p_beta" } } }],
    ["creates a Product", { product: { create: { name: "x", business: { connect: { id: "biz_beta" } } } } }],
    ["connects another Sales entry", { salesEntry: { connect: { id: "e_beta" } } }],
    ["sets salesEntryId", { salesEntryId: "e_beta" }],
  ])("refuses an item that %s", (_name, item) => {
    const one = { quantity: 1, ...item };
    violation(() => scopeArgs("SalesEntry", "create", entryWith({ create: one }), BIZ));
    violation(() => scopeArgs("SalesEntry", "create", entryWith({ create: [one] }), BIZ));
    violation(() => scopeArgs("SalesEntry", "create", entryWith({ createMany: { data: [one] } }), BIZ));
    violation(() => scopeArgs("SalesEntry", "update", { where: { id: "e1" }, data: { items: { create: [one] } } }, BIZ));
    violation(() =>
      scopeArgs("SalesEntry", "upsert", { where: { id: "e1" }, create: { items: { create: one } }, update: {} }, BIZ)
    );
  });
});

describe("scopeArgs on include and select", () => {
  it.each([
    ["Business", { include: { user: true } }],
    ["Business", { select: { user: { select: { email: true } } } }],
    ["Product", { include: { business: { include: { user: { include: { accounts: true } } } } } }],
    ["SalesItem", { select: { salesEntry: { select: { business: { select: { user: true } } } } } }],
  ])("refuses a path from %s into the auth tables", (model, args) => {
    violation(() => scopeArgs(model, "findMany", args, BIZ), /Can't read/);
  });

  it("refuses it on writes' returned rows too", () => {
    violation(() => scopeArgs("Business", "update", { data: { name: "x" }, include: { user: true } }, BIZ));
  });

  it("allows Business-owned relations, `false` and _count", () => {
    const args = {
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        business: { select: { timezone: true } },
        _count: { select: { items: true } },
      },
    };
    expect(() => scopeArgs("SalesEntry", "findMany", args, BIZ)).not.toThrow();
    expect(() => scopeArgs("Business", "findFirst", { include: { user: false } }, BIZ)).not.toThrow();
  });
});

describe("referencedIds", () => {
  it.each([
    ["SalesItem", "update", { where: { id: "i1" }, data: { productId: "p1" } }],
    ["SalesItem", "updateMany", { data: { productId: { set: "p1" } } }],
    ["DemandForecast", "create", { data: { productId: "p1" } }],
    ["DemandForecast", "createMany", { data: [{ productId: "p1" }, { productId: "p1" }] }],
    ["DemandForecast", "upsert", { where: { id: "f1" }, create: { productId: "p1" }, update: {} }],
    ["SalesEntry", "create", { data: { items: { create: [{ productId: "p1" }] } } }],
    ["SalesEntry", "create", { data: { items: { create: { productId: "p1" } } } }],
    ["SalesEntry", "update", { where: { id: "e1" }, data: { items: { createMany: { data: [{ productId: "p1" }] } } } }],
  ])("finds the productId a %s.%s stores", (model, op, args) => {
    expect(referencedIds(model, op, args)).toEqual({ Product: ["p1"] });
  });

  it("collects every distinct productId", () => {
    const args = { data: { items: { create: [{ productId: "p1" }, { productId: "p2" }, { productId: "p1" }] } } };
    expect(referencedIds("SalesEntry", "create", args)).toEqual({ Product: ["p1", "p2"] });
  });

  it.each([
    ["Product", "findMany", { where: { id: "p1" } }],
    ["SalesItem", "findMany", { where: { productId: "p1" } }],
    ["SalesItem", "deleteMany", { where: { productId: "p1" } }],
    ["SalesItem", "update", { where: { id: "i1" }, data: { quantity: 2 } }],
  ])("finds none in %s.%s", (model, op, args) => {
    expect(referencedIds(model, op, args)).toEqual({});
  });
});

describe("scopeArgs on Sales items", () => {
  it.each(WHERE_OPS)("%s scopes through the Sales entry", (op) => {
    const data = op.startsWith("update") ? { data: { quantity: 2 } } : {};
    expect(scopeArgs("SalesItem", op, { where: { id: "i1" }, ...data }, BIZ)).toEqual({
      where: { id: "i1", AND: [{ salesEntry: { businessId: BIZ } }] },
      ...data,
    });
  });

  it.each(["create", "createMany", "createManyAndReturn", "upsert"])("refuses %s outside a Sales entry", (op) => {
    violation(() => scopeArgs("SalesItem", op, { data: {}, where: {}, create: {}, update: {} }, BIZ), /through their Sales entry/);
  });

  it("can't move an item to another Sales entry", () => {
    violation(() => scopeArgs("SalesItem", "update", { where: { id: "i1" }, data: { salesEntryId: "e_beta" } }, BIZ));
    violation(() => scopeArgs("SalesItem", "update", { where: { id: "i1" }, data: { salesEntry: { connect: { id: "e_beta" } } } }, BIZ));
  });
});

describe("scopeArgs on the Business", () => {
  it.each(["findUnique", "findFirst", "findMany", "count", "update", "updateMany"])("%s matches the session's Business by id", (op) => {
    const data = op.startsWith("update") ? { data: { name: "x" } } : {};
    expect(scopeArgs("Business", op, { ...data }, BIZ)).toEqual({ where: { AND: [{ id: BIZ }] }, ...data });
  });

  it.each(["create", "createMany", "upsert", "delete", "deleteMany"])("refuses %s", (op) => {
    violation(() => scopeArgs("Business", op, { data: {} }, BIZ), /only reads and updates/);
  });

  it.each(["id", "userId"])("can't change %s", (field) => {
    violation(() => scopeArgs("Business", "update", { data: { [field]: "x" } }, BIZ));
  });

  it("refuses nested writes to its Products", () => {
    violation(() => scopeArgs("Business", "update", { data: { products: { create: { name: "x" } } } }, BIZ));
  });
});

describe("scopeArgs on unscoped models", () => {
  const unscoped = Object.entries(MODEL_SCOPES)
    .filter(([, scope]) => scope === "unscoped")
    .map(([model]) => model);

  it("covers the auth tables", () => {
    expect(unscoped.sort()).toEqual(["Account", "Session", "User", "VerificationToken"]);
  });

  it.each(unscoped)("refuses every %s query", (model) => {
    violation(() => scopeArgs(model, "findMany", {}, BIZ), /isn't available on the scoped client/);
  });
});

describe("scopeArgs fails closed", () => {
  it("refuses an unknown model", () => {
    violation(() => scopeArgs("Mystery", "findMany", {}, BIZ), /Unknown model/);
  });

  it("refuses an unknown operation", () => {
    violation(() => scopeArgs("Product", "findRaw", {}, BIZ), /Unknown operation/);
  });
});
