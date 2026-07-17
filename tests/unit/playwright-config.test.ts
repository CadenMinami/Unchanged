import { describe, expect, it } from "vitest";

import {
  resolvePlaywrightPort,
  resolvePlaywrightWebServerEnv,
} from "../../playwright.config";

describe("Playwright web server environment", () => {
  it("strips an inherited OpenAI key by default", () => {
    const resolved = resolvePlaywrightWebServerEnv({
      OPENAI_API_KEY: "not-a-real-key",
    });

    expect(resolved).toEqual({ OPENAI_API_KEY: "" });
  });

  it("inherits an OpenAI key only for the explicit live smoke opt-in", () => {
    const resolved = resolvePlaywrightWebServerEnv({
      HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "1",
      OPENAI_API_KEY: "not-a-real-key",
    });

    expect(resolved).toEqual({ OPENAI_API_KEY: "not-a-real-key" });
  });
});

describe("Playwright web server port", () => {
  it("uses an explicit isolated port for concurrent test workers", () => {
    expect(
      resolvePlaywrightPort({ HISTORY_UNBROKEN_E2E_PORT: "3201" }),
    ).toBe(3201);
  });

  it.each([undefined, "", "not-a-port", "0", "70000"])(
    "falls back to 3100 for invalid value %s",
    (value) => {
      expect(resolvePlaywrightPort({ HISTORY_UNBROKEN_E2E_PORT: value })).toBe(
        3100,
      );
    },
  );
});
