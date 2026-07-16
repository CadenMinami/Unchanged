"use client";

import {
  CharacterInterview,
  type StationId,
} from "./character-interview";
import type { BrowserSpeechAdapter } from "@/lib/voice/browser-speech";
import type { ProviderAudioAdapter } from "@/components/world/dialogue/voiced-response";
import { createBoundedAudioRecorder } from "@/lib/audio/recorder";

interface CharacterConversationPanelProps {
  providerAudioFactory?: () => ProviderAudioAdapter;
  recorderFactory?: typeof createBoundedAudioRecorder;
  speechAdapterFactory?: () => BrowserSpeechAdapter;
  stationId: StationId;
}

export function CharacterConversationPanel({
  providerAudioFactory,
  recorderFactory,
  speechAdapterFactory,
  stationId,
}: CharacterConversationPanelProps) {
  return (
    <CharacterInterview
      lockedStationId={stationId}
      providerAudioFactory={providerAudioFactory}
      recorderFactory={recorderFactory}
      speechAdapterFactory={speechAdapterFactory}
    />
  );
}
