import { defineConfig } from "@playwright/test";

import { resolveLiveOpenAIEnvironment } from "./tests/live/live-openai-environment";

const liveEnvironment = resolveLiveOpenAIEnvironment({
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE:
    process.env.HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE,
  HISTORY_UNBROKEN_LIVE_OPENAI_PORT:
    process.env.HISTORY_UNBROKEN_LIVE_OPENAI_PORT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
});
const baseURL = `http://127.0.0.1:${liveEnvironment.port}`;

export default defineConfig({
  testDir: "./tests/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/live/start-live-openai-server.ts",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
