import { describe, expect, it } from "vitest";

import nextConfig, { securityHeaders } from "../../next.config";

describe("production response security policy", () => {
  it("hides framework identification and applies the reviewed headers to every route", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers?.()).toEqual([
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]);
  });

  it("blocks framing and object embedding while preserving same-origin microphone use", () => {
    const values = Object.fromEntries(
      securityHeaders.map(({ key, value }) => [key.toLowerCase(), value]),
    );

    expect(values["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(values["content-security-policy"]).toContain("object-src 'none'");
    expect(values["content-security-policy"]).toContain("'wasm-unsafe-eval'");
    expect(values["content-security-policy"]).toContain(
      "connect-src 'self' blob:",
    );
    expect(values["content-security-policy"]).not.toContain(" ws:");
    expect(values["x-content-type-options"]).toBe("nosniff");
    expect(values["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(values["permissions-policy"]).toContain("microphone=(self)");
  });
});
