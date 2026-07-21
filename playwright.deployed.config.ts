import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

interface DeployedRegressionEnvironment {
  HISTORY_UNBROKEN_DEPLOYED_URL?: string;
}

const deployedSpecs = ["public-url-regression.spec.ts"] as const;

function invalidDeploymentUrl(message: string): Error {
  return new Error(`HISTORY_UNBROKEN_DEPLOYED_URL ${message}.`);
}

export function resolveDeployedBaseUrl(
  environment: Readonly<DeployedRegressionEnvironment>,
): string {
  const rawUrl = environment.HISTORY_UNBROKEN_DEPLOYED_URL?.trim();
  if (!rawUrl) {
    throw invalidDeploymentUrl(
      "is required and must be the HTTPS origin of the deployed application",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw invalidDeploymentUrl("must be a valid HTTPS origin");
  }

  if (parsed.protocol !== "https:") {
    throw invalidDeploymentUrl("must use HTTPS");
  }
  if (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1"
  ) {
    throw invalidDeploymentUrl("must not target a local server");
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw invalidDeploymentUrl("must not contain credentials or a custom port");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw invalidDeploymentUrl("must be an origin without a path, query, or fragment");
  }

  return parsed.origin;
}

function createDeployedRegressionConfiguration(
  baseURL: string,
): PlaywrightTestConfig {
  return {
    testDir: "./tests/deployed",
    testMatch: [...deployedSpecs],
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 90_000,
    reporter: "line",
    use: {
      baseURL,
      trace: "retain-on-failure",
    },
    // This suite exercises a public origin. It must never build, start, or
    // reuse a local Next.js server.
    webServer: undefined,
    globalSetup: "./tests/deployed/validate-deployed-target.ts",
    projects: [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
  };
}

export function resolveDeployedRegressionConfiguration(
  environment: Readonly<DeployedRegressionEnvironment>,
): PlaywrightTestConfig {
  return createDeployedRegressionConfiguration(
    resolveDeployedBaseUrl(environment),
  );
}

// Playwright imports its config before global setup runs. Keep that import
// inert when the required target is absent; the setup module validates the
// actual environment before a browser can open.
const configuredBaseUrl =
  process.env.HISTORY_UNBROKEN_DEPLOYED_URL ??
  "https://history-unbroken-target-required.invalid";

export default defineConfig(
  createDeployedRegressionConfiguration(configuredBaseUrl),
);
