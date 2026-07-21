import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

describe("deployment runtime", () => {
  it("pins Vercel to the locally tested Node major", () => {
    expect(packageJson.engines.node).toBe(">=22.18.0 <23");
  });

  it("exposes a public-origin regression command without embedding a deployment URL", () => {
    expect(packageJson.scripts["test:deployed"]).toBe(
      "playwright test --config=playwright.deployed.config.ts",
    );
  });
});
