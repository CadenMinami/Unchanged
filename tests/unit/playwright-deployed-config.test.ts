import { describe, expect, it } from "vitest";

import {
  resolveDeployedBaseUrl,
  resolveDeployedRegressionConfiguration,
} from "../../playwright.deployed.config";

describe("deployed regression configuration", () => {
  it("accepts a normalized HTTPS deployment URL without a local web server", () => {
    expect(
      resolveDeployedBaseUrl({
        HISTORY_UNBROKEN_DEPLOYED_URL: "https://history-unbroken.vercel.app/",
      }),
    ).toBe("https://history-unbroken.vercel.app");

    expect(
      resolveDeployedRegressionConfiguration({
        HISTORY_UNBROKEN_DEPLOYED_URL: "https://history-unbroken.vercel.app/",
      }),
    ).toMatchObject({
      use: { baseURL: "https://history-unbroken.vercel.app" },
      webServer: undefined,
      globalSetup: "./tests/deployed/validate-deployed-target.ts",
      testDir: "./tests/deployed",
      testMatch: ["public-url-regression.spec.ts"],
    });
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "http://history-unbroken.vercel.app",
    "http://localhost:3000",
    "https://history-unbroken.vercel.app/with-a-path",
    "https://history-unbroken.vercel.app/?preview=1",
    "https://history-unbroken.vercel.app/#fragment",
  ])("rejects an unsafe or ambiguous deployed URL: %s", (value) => {
    expect(() =>
      resolveDeployedBaseUrl({ HISTORY_UNBROKEN_DEPLOYED_URL: value }),
    ).toThrow(/HISTORY_UNBROKEN_DEPLOYED_URL/);
  });
});
