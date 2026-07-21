import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

const PROVIDER_ENVIRONMENT_VARIABLES = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_SPEECH_MODEL",
  "SPEECH_AUTHORIZATION_SECRET",
] as const;

function blankProviderEnvironment(): void {
  for (const variableName of PROVIDER_ENVIRONMENT_VARIABLES) {
    process.env[variableName] = "";
  }
}

blankProviderEnvironment();

afterEach(() => {
  try {
    cleanup();
  } finally {
    blankProviderEnvironment();
  }
});
