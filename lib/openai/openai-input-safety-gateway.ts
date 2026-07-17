import OpenAI from "openai";

import type {
  InputSafetyGateway,
  InputSafetyResult,
} from "@/lib/openai/input-safety-gateway";

interface ModerationClient {
  moderations: {
    create: (
      body: { model: string; input: string },
      options: { signal?: AbortSignal; timeout: number },
    ) => Promise<{
      results: Array<{
        flagged: boolean;
        categories: Record<string, boolean>;
      }>;
    }>;
  };
}

const MODERATION_TIMEOUT_MS = 10_000;

interface OpenAIInputSafetyGatewayOptions {
  client?: ModerationClient;
}

export class OpenAIInputSafetyGateway implements InputSafetyGateway {
  private readonly client: ModerationClient;

  constructor({ client }: OpenAIInputSafetyGatewayOptions = {}) {
    this.client = client ?? (new OpenAI({ maxRetries: 0 }) as unknown as ModerationClient);
  }

  async check(input: string, signal?: AbortSignal): Promise<InputSafetyResult> {
    const body = { model: "omni-moderation-latest", input };
    const response = await this.client.moderations.create(body, {
      timeout: MODERATION_TIMEOUT_MS,
      ...(signal ? { signal } : {}),
    });
    const result = response.results[0];
    if (!result) throw new Error("Moderation response did not include a result.");

    return {
      flagged: result.flagged,
      categories: Object.entries(result.categories)
        .filter(([, flagged]) => flagged)
        .map(([category]) => category),
    };
  }
}
