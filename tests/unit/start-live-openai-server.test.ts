import { describe, expect, it, vi } from "vitest";

import {
  type LiveOpenAICommand,
  type LiveOpenAICommandResult,
  runLiveOpenAIServer,
} from "../live/start-live-openai-server";

const API_KEY_SENTINEL = "sk-launcher-unit-test-sentinel";
const INHERITED_SECRET_SENTINEL = "inherited-secret-sentinel";
const SOURCE_ENVIRONMENT = {
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "1",
  HISTORY_UNBROKEN_LIVE_OPENAI_PORT: "3419",
  OPENAI_API_KEY: `  ${API_KEY_SENTINEL}  `,
  OPENAI_MODEL: "untrusted-model",
  OPENAI_SPEECH_MODEL: "untrusted-speech-model",
  SPEECH_AUTHORIZATION_SECRET: INHERITED_SECRET_SENTINEL,
  PATH: "/test/bin",
} as const;

const SUCCESS: LiveOpenAICommandResult = { code: 0, signal: null };

describe("live OpenAI server launcher", () => {
  it("builds with explicit blanks before generating a runtime-only secret", async () => {
    const events: string[] = [];
    const commands: LiveOpenAICommand[] = [];
    const sourceSecret = Uint8Array.from(
      { length: 32 },
      (_, index) => index + 1,
    );
    const createSpeechSecret = vi.fn(() => {
      events.push("secret");
      return sourceSecret;
    });
    const runCommand = vi.fn(async (command: LiveOpenAICommand) => {
      commands.push({
        ...command,
        args: [...command.args],
        environment: { ...command.environment },
      });
      events.push(`command:${command.args[1]}`);
      return SUCCESS;
    });

    const result = await runLiveOpenAIServer({
      environment: SOURCE_ENVIRONMENT,
      createSpeechSecret,
      runCommand,
    });

    expect(events).toEqual(["command:build", "secret", "command:start"]);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({
      command: "npm",
      args: ["run", "build"],
      environment: expect.objectContaining({
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
        OPENAI_SPEECH_MODEL: "",
        SPEECH_AUTHORIZATION_SECRET: "",
      }),
    });

    const runtimeCommand = commands[1];
    expect(runtimeCommand.command).toBe("npm");
    expect(runtimeCommand.args).toEqual([
      "run",
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3419",
    ]);
    expect(runtimeCommand.environment).toMatchObject({
      OPENAI_API_KEY: API_KEY_SENTINEL,
      OPENAI_MODEL: "gpt-5.6",
      OPENAI_SPEECH_MODEL: "gpt-4o-mini-tts",
    });
    const runtimeSecret =
      runtimeCommand.environment.SPEECH_AUTHORIZATION_SECRET ?? "";
    expect(runtimeSecret).not.toBe(INHERITED_SECRET_SENTINEL);
    expect(Buffer.from(runtimeSecret, "base64url")).toHaveLength(32);
    expect(sourceSecret).toEqual(new Uint8Array(32));
    expect(result).toEqual(SUCCESS);
    expect(JSON.stringify(result)).not.toContain(API_KEY_SENTINEL);
    expect(JSON.stringify(result)).not.toContain(runtimeSecret);
  });

  it.each([
    { name: "failure", result: { code: 1, signal: null } },
    { name: "signal", result: { code: null, signal: "SIGTERM" } },
  ] as const)(
    "stops after a build $name without generating a secret or starting runtime",
    async ({ result: buildResult }) => {
      const commands: LiveOpenAICommand[] = [];
      const createSpeechSecret = vi.fn(() => new Uint8Array(32));
      const runCommand = vi.fn(async (command: LiveOpenAICommand) => {
        commands.push(command);
        return buildResult;
      });

      const result = await runLiveOpenAIServer({
        environment: SOURCE_ENVIRONMENT,
        createSpeechSecret,
        runCommand,
      });

      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(["run", "build"]);
      expect(commands[0].environment).toMatchObject({
        OPENAI_API_KEY: "",
        OPENAI_MODEL: "",
        OPENAI_SPEECH_MODEL: "",
        SPEECH_AUTHORIZATION_SECRET: "",
      });
      expect(createSpeechSecret).not.toHaveBeenCalled();
      expect(result).toEqual(buildResult);
      expect(JSON.stringify(result)).not.toContain(API_KEY_SENTINEL);
      expect(JSON.stringify(result)).not.toContain(INHERITED_SECRET_SENTINEL);
    },
  );

  it("validates before running commands and does not include the key in errors", async () => {
    const createSpeechSecret = vi.fn(() => new Uint8Array(32));
    const runCommand = vi.fn();
    let caught: unknown;

    try {
      await runLiveOpenAIServer({
        environment: {
          ...SOURCE_ENVIRONMENT,
          HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE: "0",
        },
        createSpeechSecret,
        runCommand,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(String(caught)).toContain("HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1");
    expect(String(caught)).not.toContain(API_KEY_SENTINEL);
    expect(runCommand).not.toHaveBeenCalled();
    expect(createSpeechSecret).not.toHaveBeenCalled();
  });
});
