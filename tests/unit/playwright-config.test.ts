import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolvePlaywrightPort,
  resolvePlaywrightWebServerEnv,
} from "../../playwright.config";

const PROVIDER_ENVIRONMENT_VARIABLES = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_SPEECH_MODEL",
  "SPEECH_AUTHORIZATION_SECRET",
] as const;
const PROVIDER_ENVIRONMENT_SENTINELS = {
  OPENAI_API_KEY: "vitest-inherited-key-sentinel",
  OPENAI_MODEL: "vitest-inherited-model-sentinel",
  OPENAI_SPEECH_MODEL: "vitest-inherited-speech-model-sentinel",
  SPEECH_AUTHORIZATION_SECRET: "vitest-inherited-speech-secret-sentinel",
} as const;
const EXPECTED_NO_PROVIDER_ENVIRONMENT = {
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  OPENAI_SPEECH_MODEL: "",
  SPEECH_AUTHORIZATION_SECRET: "",
} as const;
const PROVIDER_ENVIRONMENT_PROBE =
  process.env.HISTORY_UNBROKEN_PROVIDER_ENVIRONMENT_PROBE === "1";

function stubProviderEnvironment(): void {
  for (const [variableName, sentinel] of Object.entries(
    PROVIDER_ENVIRONMENT_SENTINELS,
  )) {
    vi.stubEnv(variableName, sentinel);
  }
}

describe("ordinary Vitest provider isolation", () => {
  it("blanks inherited provider variables before an ordinary test executes", () => {
    const nonblankVariables = PROVIDER_ENVIRONMENT_VARIABLES.filter(
      (variableName) => process.env[variableName] !== "",
    );

    expect(nonblankVariables).toEqual([]);
  });

  if (!PROVIDER_ENVIRONMENT_PROBE) {
    it("blanks inherited provider sentinels without printing them", () => {
      const repositoryRoot = process.cwd();
      const vitestEntrypoint = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");
      const result = spawnSync(
        process.execPath,
        [vitestEntrypoint, "run", "tests/unit/playwright-config.test.ts", "--reporter=dot"],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          env: {
            ...process.env,
            ...PROVIDER_ENVIRONMENT_SENTINELS,
            HISTORY_UNBROKEN_PROVIDER_ENVIRONMENT_PROBE: "1",
          },
          timeout: 30_000,
        },
      );
      const output = `${result.stdout}\n${result.stderr}`;

      expect(result.error).toBeUndefined();
      for (const sentinel of Object.values(PROVIDER_ENVIRONMENT_SENTINELS)) {
        expect(output).not.toContain(sentinel);
      }
      expect(result.status, output).toBe(0);
    });
  }
});

describe("Playwright web server environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("strips inherited provider settings by default", () => {
    stubProviderEnvironment();

    const resolved = resolvePlaywrightWebServerEnv();

    expect(resolved).toEqual(EXPECTED_NO_PROVIDER_ENVIRONMENT);
  });

  it("strips inherited provider settings even when the live smoke flag is set", () => {
    vi.stubEnv("HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE", "1");
    stubProviderEnvironment();

    const resolved = resolvePlaywrightWebServerEnv();

    expect(resolved).toEqual(EXPECTED_NO_PROVIDER_ENVIRONMENT);
  });

  it("serializes four blanks without inherited provider sentinels", async () => {
    stubProviderEnvironment();
    vi.resetModules();

    const { default: config } = await import("../../playwright.config");
    const serializedConfig = JSON.stringify(config);

    expect(config.webServer).toMatchObject({
      env: EXPECTED_NO_PROVIDER_ENVIRONMENT,
    });
    for (const sentinel of Object.values(PROVIDER_ENVIRONMENT_SENTINELS)) {
      expect(serializedConfig).not.toContain(sentinel);
    }
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
