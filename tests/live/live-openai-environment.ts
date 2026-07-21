export type LiveOpenAIEnvironmentSource = Readonly<
  Record<string, string | undefined>
> & {
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE?: string;
  HISTORY_UNBROKEN_LIVE_OPENAI_PORT?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_SPEECH_MODEL?: string;
  SPEECH_AUTHORIZATION_SECRET?: string;
};

export interface ResolvedLiveOpenAIEnvironment {
  port: number;
}

const BUILD_BLANKED_VARIABLES = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_SPEECH_MODEL",
  "SPEECH_AUTHORIZATION_SECRET",
] as const;

function requireLiveOpenAIKey(
  environment: LiveOpenAIEnvironmentSource,
): string {
  if (environment.HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE !== "1") {
    throw new Error(
      "Live OpenAI smoke is disabled. Set HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1 to opt in; no build or provider request was started.",
    );
  }

  const openAIKey = environment.OPENAI_API_KEY?.trim();
  if (!openAIKey) {
    throw new Error(
      "Live OpenAI smoke requires a nonblank OPENAI_API_KEY; no build or provider request was started.",
    );
  }
  return openAIKey;
}

export function resolveLiveOpenAIEnvironment(
  environment: LiveOpenAIEnvironmentSource,
): ResolvedLiveOpenAIEnvironment {
  requireLiveOpenAIKey(environment);

  const portCandidate = Number(environment.HISTORY_UNBROKEN_LIVE_OPENAI_PORT);
  const port =
    Number.isInteger(portCandidate) &&
    portCandidate >= 1_024 &&
    portCandidate <= 65_535
      ? portCandidate
      : 3_400;

  return { port };
}

export function resolveLiveOpenAIBuildEnvironment(
  environment: LiveOpenAIEnvironmentSource,
): NodeJS.ProcessEnv {
  requireLiveOpenAIKey(environment);
  const buildEnvironment = { ...environment } as NodeJS.ProcessEnv;
  for (const variable of BUILD_BLANKED_VARIABLES) {
    buildEnvironment[variable] = "";
  }
  return buildEnvironment;
}

export function resolveLiveOpenAIRuntimeEnvironment(
  environment: LiveOpenAIEnvironmentSource,
  speechSecretBytes: Uint8Array,
): NodeJS.ProcessEnv {
  const openAIKey = requireLiveOpenAIKey(environment);
  if (speechSecretBytes.byteLength < 32) {
    throw new Error(
      "Live OpenAI smoke requires at least 32 bytes of ephemeral speech-secret entropy.",
    );
  }

  return {
    ...resolveLiveOpenAIBuildEnvironment(environment),
    OPENAI_API_KEY: openAIKey,
    OPENAI_MODEL: "gpt-5.6",
    OPENAI_SPEECH_MODEL: "gpt-4o-mini-tts",
    SPEECH_AUTHORIZATION_SECRET:
      Buffer.from(speechSecretBytes).toString("base64url"),
  };
}
