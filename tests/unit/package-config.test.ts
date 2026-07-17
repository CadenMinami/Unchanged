import { describe, expect, it } from "vitest";

import packageJson from "../../package.json";

describe("deployment runtime", () => {
  it("pins Vercel to the locally tested Node major", () => {
    expect(packageJson.engines.node).toBe("22.x");
  });
});
