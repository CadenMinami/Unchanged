import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";

import type { LiveOpenAIEnvironmentSource } from "./live-openai-environment";

const liveEnvironmentModulePath = "./live-openai-environment.ts";
const {
  resolveLiveOpenAIBuildEnvironment,
  resolveLiveOpenAIEnvironment,
  resolveLiveOpenAIRuntimeEnvironment,
} = (await import(liveEnvironmentModulePath)) as typeof import("./live-openai-environment");

type ForwardedSignal = "SIGINT" | "SIGTERM";

export interface LiveOpenAICommand {
  command: string;
  args: readonly string[];
  environment: NodeJS.ProcessEnv;
}

export interface LiveOpenAICommandResult {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export type LiveOpenAICommandRunner = (
  command: LiveOpenAICommand,
) => Promise<LiveOpenAICommandResult>;

interface LiveOpenAIServerDependencies {
  environment?: LiveOpenAIEnvironmentSource;
  createSpeechSecret?: () => Uint8Array;
  runCommand?: LiveOpenAICommandRunner;
}

const FORWARDED_SIGNALS: readonly ForwardedSignal[] = ["SIGINT", "SIGTERM"];

async function runChildCommand({
  command,
  args,
  environment,
}: LiveOpenAICommand): Promise<LiveOpenAICommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      env: environment,
      stdio: "inherit",
    });
    let forwardedSignal: NodeJS.Signals | null = null;

    const signalHandlers = new Map<ForwardedSignal, () => void>();
    const cleanup = (): void => {
      for (const [signal, handler] of signalHandlers) {
        process.off(signal, handler);
      }
    };

    for (const signal of FORWARDED_SIGNALS) {
      const handler = (): void => {
        forwardedSignal ??= signal;
        child.kill(signal);
      };
      signalHandlers.set(signal, handler);
      process.once(signal, handler);
    }

    child.once("error", (error) => {
      cleanup();
      reject(error);
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolve({ code, signal: signal ?? forwardedSignal });
    });
  });
}

export async function runLiveOpenAIServer({
  environment = process.env,
  createSpeechSecret = () => randomBytes(32),
  runCommand = runChildCommand,
}: LiveOpenAIServerDependencies = {}): Promise<LiveOpenAICommandResult> {
  const { port } = resolveLiveOpenAIEnvironment(environment);
  const buildResult = await runCommand({
    command: "npm",
    args: ["run", "build"],
    environment: resolveLiveOpenAIBuildEnvironment(environment),
  });
  if (buildResult.code !== 0 || buildResult.signal) return buildResult;

  const speechSecretBytes = createSpeechSecret();
  let runtimeEnvironment: NodeJS.ProcessEnv;
  try {
    runtimeEnvironment = resolveLiveOpenAIRuntimeEnvironment(
      environment,
      speechSecretBytes,
    );
  } finally {
    speechSecretBytes.fill(0);
  }

  return runCommand({
    command: "npm",
    args: [
      "run",
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    environment: runtimeEnvironment,
  });
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && import.meta.url === pathToFileURL(entryPoint).href;
}

if (isMainModule()) {
  runLiveOpenAIServer()
    .then((result) => {
      if (result.signal) {
        process.kill(process.pid, result.signal);
        return;
      }
      process.exitCode = result.code ?? 1;
    })
    .catch((error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : "Live OpenAI server launcher failed before startup.";
      console.error(message);
      process.exitCode = 1;
    });
}
