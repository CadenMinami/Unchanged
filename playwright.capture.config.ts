import { defineConfig, devices } from "@playwright/test";

function resolveCapturePort(value: string | undefined): number {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 1_024 && candidate <= 65_535
    ? candidate
    : 3_300;
}

const port = resolveCapturePort(process.env.HISTORY_UNBROKEN_CAPTURE_PORT);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/capture",
  fullyParallel: false,
  workers: 1,
  timeout: 360_000,
  preserveOutput: "always",
  reporter: "line",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 1_440, height: 900 },
  },
  webServer: {
    command: `npm run build && npm run start -- --hostname 127.0.0.1 --port ${port}`,
    env: {
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OPENAI_SPEECH_MODEL: "",
      SPEECH_AUTHORIZATION_SECRET: "",
    },
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
