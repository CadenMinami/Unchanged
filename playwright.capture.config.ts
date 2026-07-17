import { defineConfig, devices } from "@playwright/test";

function resolveCapturePort(value: string | undefined): number {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 1_024 && candidate <= 65_535
    ? candidate
    : 3_300;
}

const port = resolveCapturePort(process.env.HISTORY_UNBROKEN_CAPTURE_PORT);
const baseURL = `http://127.0.0.1:${port}`;
const useLiveProvider = process.env.HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE === "1";

export default defineConfig({
  testDir: "./tests/capture",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
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
      OPENAI_API_KEY: useLiveProvider ? process.env.OPENAI_API_KEY ?? "" : "",
    },
    url: baseURL,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
