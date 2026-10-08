import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import type { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SecretsService } from "./secrets.service.js";

const ENV_NAME = "TEST_ONLY_SECRET";
const SM_ID = "freshcast/test-only-secret";

describe("SecretsService", () => {
  const send = vi.fn();
  let service: SecretsService;

  beforeEach(() => {
    delete process.env[ENV_NAME];
    send.mockReset();
    vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    service = new SecretsService({ send } as unknown as SecretsManagerClient);
  });

  afterEach(() => {
    delete process.env[ENV_NAME];
    vi.restoreAllMocks();
  });

  it("returns the env var when set, without calling Secrets Manager", async () => {
    process.env[ENV_NAME] = "from-env";

    await expect(service.get(ENV_NAME, SM_ID)).resolves.toBe("from-env");
    expect(send).not.toHaveBeenCalled();
  });

  it("falls back to Secrets Manager and memoizes the result", async () => {
    send.mockResolvedValueOnce({ SecretString: "from-sm" });

    await expect(service.get(ENV_NAME, SM_ID)).resolves.toBe("from-sm");
    await expect(service.get(ENV_NAME, SM_ID)).resolves.toBe("from-sm");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("returns null when Secrets Manager fails", async () => {
    send.mockRejectedValueOnce(new Error("AccessDenied"));

    await expect(service.get(ENV_NAME, SM_ID)).resolves.toBeNull();
  });
});
