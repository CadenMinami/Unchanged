import { describe, expect, it, vi } from "vitest";

import { OpenAIInputSafetyGateway } from "@/lib/openai/openai-input-safety-gateway";

describe("OpenAIInputSafetyGateway", () => {
  it("maps the moderation result without exposing provider-specific response data", async () => {
    const create = vi.fn().mockResolvedValue({
      results: [
        {
          flagged: true,
          categories: {
            harassment: false,
            violence: true,
            "self-harm": false,
          },
        },
      ],
    });
    const gateway = new OpenAIInputSafetyGateway({ client: { moderations: { create } } });

    const result = await gateway.check("unsafe test input");

    expect(result).toEqual({ flagged: true, categories: ["violence"] });
    expect(create).toHaveBeenCalledWith(
      {
        model: "omni-moderation-latest",
        input: "unsafe test input",
      },
      { timeout: 10_000 },
    );
  });
});
