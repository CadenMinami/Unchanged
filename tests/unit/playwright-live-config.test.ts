import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resolveLiveOpenAIBuildEnvironment,
  resolveLiveOpenAIEnvironment,
  resolveLiveOpenAIRuntimeEnvironment,
} from "../live/live-openai-environment";

const API_KEY_SENTINEL = "sk-live-unit-test-sentinel";
const SPEECH_SECRET_BYTES = Uint8Array.from(
  { length: 32 },
  (_, index) => index + 1,
);
const SOURCE_ENVIRONMENT = {
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "1",
  HISTORY_UNBROKEN_LIVE_OPENAI_PORT: "3417",
  OPENAI_API_KEY: `  ${API_KEY_SENTINEL}  `,
  OPENAI_MODEL: "wrong-model",
  OPENAI_SPEECH_MODEL: "wrong-speech-model",
  SPEECH_AUTHORIZATION_SECRET: "inherited-speech-secret",
  PATH: "/test/bin",
} as const;

describe("live OpenAI Playwright environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed unless explicitly opted in with a nonblank key", () => {
    expect(() =>
      resolveLiveOpenAIEnvironment({ OPENAI_API_KEY: API_KEY_SENTINEL }),
    ).toThrow("HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1");

    for (const openAIKey of [undefined, "", "   "]) {
      expect(() =>
        resolveLiveOpenAIEnvironment({
          HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "1",
          OPENAI_API_KEY: openAIKey,
        }),
      ).toThrow("nonblank OPENAI_API_KEY");
    }

    try {
      resolveLiveOpenAIEnvironment({
        HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "0",
        OPENAI_API_KEY: API_KEY_SENTINEL,
      });
    } catch (error) {
      expect(String(error)).not.toContain(API_KEY_SENTINEL);
    }
  });

  it("returns only validated, secret-free Playwright metadata", () => {
    expect(
      resolveLiveOpenAIEnvironment(SOURCE_ENVIRONMENT),
    ).toEqual({ port: 3_417 });

    for (const port of [undefined, "", "1023", "65536", "3400.5", "not-a-port"]) {
      expect(
        resolveLiveOpenAIEnvironment({
          ...SOURCE_ENVIRONMENT,
          HISTORY_UNBROKEN_LIVE_OPENAI_PORT: port,
        }).port,
      ).toBe(3_400);
    }
  });

  it("explicitly blanks provider credentials and model settings in the launcher build environment", () => {
    const buildEnvironment =
      resolveLiveOpenAIBuildEnvironment(SOURCE_ENVIRONMENT);

    expect(buildEnvironment).toMatchObject({
      HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "1",
      OPENAI_API_KEY: "",
      OPENAI_MODEL: "",
      OPENAI_SPEECH_MODEL: "",
      PATH: "/test/bin",
      SPEECH_AUTHORIZATION_SECRET: "",
    });
  });

  it("keeps explicit build blanks authoritative over .env.local sentinels", () => {
    const fixtureDirectory = mkdtempSync(
      join(tmpdir(), "history-unbroken-live-build-env-"),
    );
    const sentinels = {
      OPENAI_API_KEY: "dotenv-key-sentinel",
      OPENAI_MODEL: "dotenv-model-sentinel",
      OPENAI_SPEECH_MODEL: "dotenv-speech-model-sentinel",
      SPEECH_AUTHORIZATION_SECRET: "dotenv-speech-secret-sentinel",
    } as const;

    try {
      writeFileSync(
        join(fixtureDirectory, ".env.local"),
        `${Object.entries(sentinels)
          .map(([name, value]) => `${name}=${value}`)
          .join("\n")}\n`,
      );
      const nextEnvModulePath = require.resolve("@next/env");
      const loaderScript = `
        const { loadEnvConfig } = require(${JSON.stringify(nextEnvModulePath)});
        const { combinedEnv } = loadEnvConfig(process.cwd(), false, console, true);
        process.stdout.write(JSON.stringify({
          OPENAI_API_KEY: combinedEnv.OPENAI_API_KEY,
          OPENAI_MODEL: combinedEnv.OPENAI_MODEL,
          OPENAI_SPEECH_MODEL: combinedEnv.OPENAI_SPEECH_MODEL,
          SPEECH_AUTHORIZATION_SECRET: combinedEnv.SPEECH_AUTHORIZATION_SECRET,
        }));
      `;
      const loaded = spawnSync(process.execPath, ["-e", loaderScript], {
        cwd: fixtureDirectory,
        encoding: "utf8",
        env: resolveLiveOpenAIBuildEnvironment({
          ...SOURCE_ENVIRONMENT,
          NODE_ENV: "production",
        }),
      });

      expect(loaded.stderr).toBe("");
      expect(loaded.status).toBe(0);
      expect(JSON.parse(loaded.stdout)).toEqual({
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
        OPENAI_SPEECH_MODEL: "",
        SPEECH_AUTHORIZATION_SECRET: "",
      });
      for (const sentinel of Object.values(sentinels)) {
        expect(loaded.stdout).not.toContain(sentinel);
      }
    } finally {
      rmSync(fixtureDirectory, { force: true, recursive: true });
    }
  });

  it("pins runtime models and uses the key plus a fresh 32-byte speech secret", () => {
    const runtimeEnvironment = resolveLiveOpenAIRuntimeEnvironment(
      SOURCE_ENVIRONMENT,
      SPEECH_SECRET_BYTES,
    );

    expect(runtimeEnvironment).toMatchObject({
      OPENAI_API_KEY: API_KEY_SENTINEL,
      OPENAI_MODEL: "gpt-5.6",
      OPENAI_SPEECH_MODEL: "gpt-4o-mini-tts",
      PATH: "/test/bin",
    });
    expect(runtimeEnvironment.SPEECH_AUTHORIZATION_SECRET).not.toBe(
      SOURCE_ENVIRONMENT.SPEECH_AUTHORIZATION_SECRET,
    );
    expect(
      Buffer.from(
        runtimeEnvironment.SPEECH_AUTHORIZATION_SECRET ?? "",
        "base64url",
      ),
    ).toHaveLength(32);
    expect(() =>
      resolveLiveOpenAIRuntimeEnvironment(
        SOURCE_ENVIRONMENT,
        new Uint8Array(31),
      ),
    ).toThrow("at least 32 bytes");
  });

  it("keeps the exported Playwright config free of credentials and secrets", async () => {
    vi.stubEnv("HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE", "1");
    vi.stubEnv("OPENAI_API_KEY", API_KEY_SENTINEL);
    vi.stubEnv("SPEECH_AUTHORIZATION_SECRET", "serialized-secret-sentinel");
    vi.resetModules();

    const { default: liveConfig } = await import("../../playwright.live.config");
    const serializedConfig = JSON.stringify(liveConfig);

    expect(serializedConfig).not.toContain(API_KEY_SENTINEL);
    expect(serializedConfig).not.toContain("serialized-secret-sentinel");
    expect(serializedConfig).not.toContain("SPEECH_AUTHORIZATION_SECRET");
    expect(liveConfig.webServer).toMatchObject({
      command: "node tests/live/start-live-openai-server.ts",
    });
    expect(liveConfig.webServer).not.toHaveProperty("env");
  }, 15_000);
});
