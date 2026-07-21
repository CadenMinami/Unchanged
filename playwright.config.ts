import { defineConfig, devices } from "@playwright/test";

interface PlaywrightPortSourceEnv {
  HISTORY_UNBROKEN_E2E_PORT?: string;
}

export function resolvePlaywrightPort(
  environment: Readonly<PlaywrightPortSourceEnv>,
): number {
  const candidate = Number(environment.HISTORY_UNBROKEN_E2E_PORT);
  return Number.isInteger(candidate) && candidate >= 1_024 && candidate <= 65_535
    ? candidate
    : 3_100;
}

const e2ePort = resolvePlaywrightPort({
  HISTORY_UNBROKEN_E2E_PORT: process.env.HISTORY_UNBROKEN_E2E_PORT,
});
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;
const requiresFreshProductionServer =
  process.env.HISTORY_UNBROKEN_PERFORMANCE === "1";

interface PlaywrightWebServerEnvironment {
  [variableName: string]: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  OPENAI_SPEECH_MODEL: string;
  SPEECH_AUTHORIZATION_SECRET: string;
}

export function resolvePlaywrightWebServerEnv(): PlaywrightWebServerEnvironment {
  return {
    OPENAI_API_KEY: "",
    OPENAI_MODEL: "",
    OPENAI_SPEECH_MODEL: "",
    SPEECH_AUTHORIZATION_SECRET: "",
  };
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: requiresFreshProductionServer ? 0 : process.env.CI ? 2 : 0,
  testIgnore: requiresFreshProductionServer
    ? []
    : ["**/world-performance.spec.ts"],
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${e2ePort}`,
    env: resolvePlaywrightWebServerEnv(),
    url: e2eBaseUrl,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
