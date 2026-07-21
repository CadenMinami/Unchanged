import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../../app/api/health/route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the public case identity without querying a provider", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      application: "history-unbroken",
      case: {
        id: "varennes",
        schemaVersion: "1.0.0",
        version: "1.0.3",
      },
      build: { id: null },
    });
  });

  it("exposes only a validated deployment build identifier", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234-release");
    const accepted = await GET();
    await expect(accepted.json()).resolves.toMatchObject({
      build: { id: "abc1234-release" },
    });

    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "unsafe value with spaces");
    const rejected = await GET();
    await expect(rejected.json()).resolves.toMatchObject({
      build: { id: null },
    });
  });
});
