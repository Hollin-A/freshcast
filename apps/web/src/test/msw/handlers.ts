import { http } from "msw";
import type * as z from "zod";
import {
  chatSchema,
  createBusinessSchema,
  createSalesSchema,
  parseSalesSchema,
  productInputSchema,
  receiptUploadSchema,
  updateProductSchema,
  type ParsedItem,
} from "@freshcast/shared";
import type { ProductRecord } from "@/hooks/use-products";
import type { SalesEntry } from "@/hooks/use-sales";
import { fail, ok } from "./envelope";
import { onboarded } from "./fixtures/onboarded";
import type { Scenario } from "./fixtures/types";

// One handler per Legacy API endpoint the App calls. Request bodies are
// checked against the shared schemas, so a component sending a malformed
// body gets the same 400 as from the real route. Handlers don't keep state:
// a mutation returns its result, but later reads still return the fixture.
// Override a single endpoint in a test with server.use(...).

async function parseBody<S extends z.ZodType>(request: Request, schema: S) {
  return schema.safeParse(await request.json().catch(() => null));
}

const invalid = (error: z.ZodError) =>
  fail(400, "VALIDATION_ERROR", "Invalid input", { issues: error.issues });

function toRecord(p: Scenario["products"][number]): ProductRecord {
  return { id: p.id, name: p.name, defaultUnit: p.defaultUnit, isActive: p.isActive };
}

export function createHandlers(scenario: Scenario = onboarded) {
  const { business, products, sales, dashboard, dayForecast } = scenario;
  const findProduct = (id: string) => products.find((p) => p.id === id);

  return [
    // Auth
    http.post("/api/auth/signup", () =>
      ok({ message: "Account created successfully" }, { status: 201 }),
    ),
    http.post("/api/auth/forgot-password", () =>
      ok({ message: "If an account exists, a reset link has been sent." }),
    ),
    http.post("/api/auth/reset-password", () =>
      ok({ message: "Password reset successfully. You can now log in." }),
    ),
    http.post("/api/auth/send-verification", () =>
      ok({ message: "Verification email sent" }),
    ),

    // Account and business
    http.delete("/api/account", () => ok({ message: "Account deleted successfully" })),
    http.post("/api/business", async ({ request }) => {
      const body = await parseBody(request, createBusinessSchema);
      if (!body.success) return invalid(body.error);
      const { products: newProducts, ...details } = body.data;
      return ok(
        {
          id: business.id,
          ...details,
          onboarded: true,
          products: newProducts.map((p, i) => ({
            id: `prod_new_${i}`,
            name: p.name,
            defaultUnit: p.defaultUnit ?? null,
          })),
        },
        { status: 201 },
      );
    }),
    http.post("/api/demo", () =>
      dashboard.hasAnySales
        ? fail(409, "CONFLICT", "Demo data can only be loaded on an empty account")
        : ok({ message: "Demo data loaded. Your dashboard is ready." }, { status: 201 }),
    ),

    // Dashboard and predictions
    http.get("/api/dashboard", () => ok(dashboard)),
    http.get("/api/predictions", () =>
      dayForecast
        ? ok(dayForecast)
        : fail(422, "INSUFFICIENT_DATA", "Log at least 5 days of sales to see predictions"),
    ),

    // Products
    http.get("/api/products", ({ request }) => {
      const active = new URL(request.url).searchParams.get("active") !== "false";
      return ok(active ? products.filter((p) => p.isActive) : products);
    }),
    http.post("/api/products", async ({ request }) => {
      const body = await parseBody(request, productInputSchema);
      if (!body.success) return invalid(body.error);
      if (products.some((p) => p.name.toLowerCase() === body.data.name.toLowerCase())) {
        return fail(409, "CONFLICT", "Product with this name already exists");
      }
      return ok<ProductRecord>(
        { id: "prod_new", name: body.data.name, defaultUnit: body.data.defaultUnit ?? null, isActive: true },
        { status: 201 },
      );
    }),
    http.patch("/api/products", async ({ request }) => {
      const body = await parseBody(request, updateProductSchema);
      if (!body.success) return invalid(body.error);
      const { id, ...changes } = body.data;
      const product = findProduct(id);
      if (!product) return fail(404, "NOT_FOUND", "Product not found");
      return ok<ProductRecord>({ ...toRecord(product), ...changes });
    }),

    // Sales
    http.get("/api/sales", ({ request }) => {
      const params = new URL(request.url).searchParams;
      const from = params.get("from");
      const to = params.get("to");
      const limit = Math.min(Number(params.get("limit") ?? 30), 100);
      const offset = Number(params.get("offset") ?? 0);
      const matching = sales.filter((e) => {
        const date = e.date.split("T")[0];
        return (!from || date >= from) && (!to || date <= to);
      });
      return ok(matching.slice(offset, offset + limit), {
        meta: { total: matching.length, limit, offset },
      });
    }),
    http.post("/api/sales", async ({ request }) => {
      const body = await parseBody(request, createSalesSchema);
      if (!body.success) return invalid(body.error);
      const { date, inputMethod, rawInput, receiptKey, items } = body.data;
      if (items.some((i) => !findProduct(i.productId))) {
        return fail(400, "VALIDATION_ERROR", "One or more products do not belong to your business");
      }
      const entry: SalesEntry = {
        id: "entry_new",
        date: `${date}T00:00:00.000Z`,
        inputMethod,
        rawInput: rawInput ?? null,
        receiptKey: receiptKey ?? null,
        createdAt: `${date}T12:00:00.000Z`,
        items: items.map((i, n) => ({
          id: `item_new_${n}`,
          quantity: i.quantity,
          unit: i.unit ?? null,
          product: { id: i.productId, name: findProduct(i.productId)!.name },
        })),
      };
      return ok(entry, { status: 201 });
    }),
    http.delete("/api/sales/:id", ({ params }) =>
      sales.some((e) => e.id === params.id)
        ? ok({ message: "Entry deleted" })
        : fail(404, "NOT_FOUND", "Sales entry not found"),
    ),
    // Matches each product named in the text; the real parser is covered by
    // the service tests.
    http.post("/api/sales/parse", async ({ request }) => {
      const body = await parseBody(request, parseSalesSchema);
      if (!body.success) return invalid(body.error);
      const text = body.data.text.toLowerCase();
      const parsed: ParsedItem[] = products
        .filter((p) => text.includes(p.name.toLowerCase()))
        .map((p) => ({
          rawText: p.name,
          product: p.name,
          productId: p.id,
          quantity: 1,
          unit: p.defaultUnit,
          matched: true,
          status: "ok",
        }));
      return ok({ parsed, unmatched: [], parseMethod: "rule-based" });
    }),

    // Receipts
    http.post("/api/receipts/upload", async ({ request }) => {
      const body = await parseBody(request, receiptUploadSchema);
      if (!body.success) return invalid(body.error);
      return ok({
        key: `receipts/${business.id}/receipt.jpg`,
        uploadUrl: "https://receipts.example.com/upload",
        previewUrl: "https://receipts.example.com/preview",
        expiresInSeconds: 300,
      });
    }),
    http.put("https://receipts.example.com/upload", () => new Response(null, { status: 200 })),
    http.post("/api/receipts/parse", () =>
      ok({
        parsed: products.slice(0, 2).map<ParsedItem>((p) => ({
          rawText: p.name,
          product: p.name,
          productId: p.id,
          quantity: 2,
          unit: p.defaultUnit,
          matched: true,
          status: "ok",
        })),
        unmatched: [],
        source: "receipt",
        key: `receipts/${business.id}/receipt.jpg`,
        extractedText: products.slice(0, 2).map((p) => `${p.name} 2`).join("\n"),
      }),
    ),

    // Chat
    http.post("/api/chat", async ({ request }) => {
      const body = await parseBody(request, chatSchema);
      if (!body.success) return invalid(body.error);
      return ok({ response: `${products[0]?.name ?? "Your top product"} is selling best this week.` });
    }),
  ];
}
