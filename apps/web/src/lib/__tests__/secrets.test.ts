import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = sendMock;
  },
  GetSecretValueCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { getSecret, __resetSecretsCacheForTests } from "../secrets";

describe("getSecret", () => {
  const ENV_NAME = "TEST_ONLY_SECRET";
  const SM_ID = "freshcast/test-only-secret";
  const originalValue = process.env[ENV_NAME];

  beforeEach(() => {
    delete process.env[ENV_NAME];
    sendMock.mockReset();
    __resetSecretsCacheForTests();
  });

  afterEach(() => {
    if (originalValue === undefined) delete process.env[ENV_NAME];
    else process.env[ENV_NAME] = originalValue;
  });

  it("returns the env var when set, without touching SM", async () => {
    process.env[ENV_NAME] = "from-env";

    const value = await getSecret(ENV_NAME, SM_ID);

    expect(value).toBe("from-env");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("falls back to SM when env is unset and returns SecretString", async () => {
    sendMock.mockResolvedValueOnce({ SecretString: "from-sm" });

    const value = await getSecret(ENV_NAME, SM_ID);

    expect(value).toBe("from-sm");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("memoizes the SM result so a warm process hits SM at most once per id", async () => {
    sendMock.mockResolvedValueOnce({ SecretString: "from-sm" });

    const a = await getSecret(ENV_NAME, SM_ID);
    const b = await getSecret(ENV_NAME, SM_ID);
    const c = await getSecret(ENV_NAME, SM_ID);

    expect(a).toBe("from-sm");
    expect(b).toBe("from-sm");
    expect(c).toBe("from-sm");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns null on SM failure (soft-fail) so callers can degrade gracefully", async () => {
    sendMock.mockRejectedValueOnce(new Error("AccessDenied"));

    const value = await getSecret(ENV_NAME, SM_ID);

    expect(value).toBeNull();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when SM responds with no SecretString", async () => {
    sendMock.mockResolvedValueOnce({});

    const value = await getSecret(ENV_NAME, SM_ID);

    expect(value).toBeNull();
  });

  it("prefers env over SM even when both would resolve", async () => {
    process.env[ENV_NAME] = "from-env";
    sendMock.mockResolvedValue({ SecretString: "from-sm" });

    const value = await getSecret(ENV_NAME, SM_ID);

    expect(value).toBe("from-env");
    expect(sendMock).not.toHaveBeenCalled();
  });
});
