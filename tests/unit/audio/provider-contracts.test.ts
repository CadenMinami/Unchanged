import { describe, expect, it, vi } from "vitest";

import {
  OpenAISpeechProvider,
  type SpeechProviderInput,
} from "@/lib/audio/speech-service";
import {
  OpenAITranscriptionProvider,
  type TranscriptionProviderInput,
} from "@/lib/audio/transcription-service";

describe("OpenAI audio provider contracts", () => {
  it("uses the current file-oriented transcription model and JSON response", async () => {
    const create = vi.fn(async () => ({ text: "Which road did you take?" }));
    const provider = new OpenAITranscriptionProvider({
      audio: { transcriptions: { create } },
    });
    const input: TranscriptionProviderInput = {
      audio: new Uint8Array([82, 73, 70, 70]),
      fileName: "clip.wav",
      mimeType: "audio/wav",
    };

    await provider.transcribe(input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o-transcribe",
        response_format: "json",
        language: "en",
      }),
      expect.objectContaining({ timeout: 10_000 }),
    );
  });

  it("uses the current TTS model with WAV output and the approved logical voice mapping", async () => {
    const create = vi.fn(async () => new Response(new Uint8Array([82, 73, 70, 70])));
    const provider = new OpenAISpeechProvider({
      client: { audio: { speech: { create } } },
    });
    const input: SpeechProviderInput = {
      input: "Exact authorized caption.",
      providerVoice: "cedar",
    };

    await provider.synthesize(input);

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        input: input.input,
        model: "gpt-4o-mini-tts",
        voice: "cedar",
        response_format: "wav",
      }),
      expect.objectContaining({ timeout: 10_000 }),
    );
  });
});
