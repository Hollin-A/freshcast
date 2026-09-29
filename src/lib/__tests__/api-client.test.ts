import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchWithMeta, ApiRequestError } from "../api-client";

function mockFetch(status: number, body: unknown, asJson = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: asJson ? async () => body : async () => { throw new SyntaxError("not json"); },
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("returns the envelope's data on success", async () => {
    mockFetch(200, { data: { id: "p1", name: "Eggs" } });
    await expect(apiFetch("/api/products")).resolves.toEqual({ id: "p1", name: "Eggs" });
  });

  it("passes the request through to fetch", async () => {
    const fetchMock = mockFetch(201, { data: null });
    const init = { method: "POST", body: "{}" };
    await apiFetch("/api/sales", init);
    expect(fetchMock).toHaveBeenCalledWith("/api/sales", init);
  });

  it("throws ApiRequestError with the envelope's error fields", async () => {
    mockFetch(409, {
      error: { code: "CONFLICT", message: "Product with this name already exists", details: { name: "Eggs" } },
    });
    const err = await apiFetch("/api/products").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      message: "Product with this name already exists",
      status: 409,
      code: "CONFLICT",
      details: { name: "Eggs" },
    });
  });

  it("uses the fallback message when the error body has none", async () => {
    mockFetch(500, { error: { code: "INTERNAL_ERROR", message: "" } });
    await expect(
      apiFetch("/api/dashboard", undefined, { fallbackMessage: "Failed to fetch dashboard" })
    ).rejects.toThrow("Failed to fetch dashboard");
  });

  it("handles non-JSON error responses", async () => {
    mockFetch(502, null, false);
    const err = await apiFetch("/api/chat").catch((e) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 502, message: "Request failed (502)" });
  });
});

describe("apiFetchWithMeta", () => {
  it("returns data and meta", async () => {
    mockFetch(200, { data: [{ id: "s1" }], meta: { total: 1, limit: 50, offset: 0 } });
    await expect(apiFetchWithMeta("/api/sales")).resolves.toEqual({
      data: [{ id: "s1" }],
      meta: { total: 1, limit: 50, offset: 0 },
    });
  });
});
