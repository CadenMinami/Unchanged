import { afterEach, describe, expect, it, vi } from "vitest";

const PROVIDER_ENVIRONMENT_SENTINELS = {
  OPENAI_API_KEY: "capture-inherited-key-sentinel",
  OPENAI_MODEL: "capture-inherited-model-sentinel",
  OPENAI_SPEECH_MODEL: "capture-inherited-speech-model-sentinel",
  SPEECH_AUTHORIZATION_SECRET: "capture-inherited-speech-secret-sentinel",
} as const;
const EXPECTED_NO_PROVIDER_ENVIRONMENT = {
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  OPENAI_SPEECH_MODEL: "",
  SPEECH_AUTHORIZATION_SECRET: "",
} as const;

describe("capture Playwright web server environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("serializes four blanks without inherited provider sentinels", async () => {
    vi.stubEnv("HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE", "1");
    for (const [variableName, sentinel] of Object.entries(
      PROVIDER_ENVIRONMENT_SENTINELS,
    )) {
      vi.stubEnv(variableName, sentinel);
    }
    vi.resetModules();

    const { default: captureConfig } = await import(
      "../../playwright.capture.config"
    );
    const serializedConfig = JSON.stringify(captureConfig);

    expect(captureConfig.webServer).toMatchObject({
      env: EXPECTED_NO_PROVIDER_ENVIRONMENT,
    });
    for (const sentinel of Object.values(PROVIDER_ENVIRONMENT_SENTINELS)) {
      expect(serializedConfig).not.toContain(sentinel);
    }
  }, 15_000);

  it("preserves successful capture artifacts for manual review", async () => {
    vi.resetModules();

    const { default: captureConfig } = await import(
      "../../playwright.capture.config"
    );

    expect(captureConfig.preserveOutput).toBe("always");
  });
});
